from encodings import oem
from screeninfo import get_monitors
from collections import namedtuple
from PIL import ImageGrab, Image
from matplotlib import pyplot as plt

import pygetwindow as gw
import os
import glob
import pytesseract
import numpy as np
import json
import cv2

Resolution = namedtuple('Resolution', ['x', 'y'])

REF_OFFSETS = {
    'team-0': {
        'towers': {
            "left": 740,
            "right": 1140,
        },
        'gold': {
            "left": 800,
            "right": 1060,
        }
    },
    'team-1': {
        'towers': {
            "left": 1180,
            "right": 695,
        },
        'gold': {
            "left": 1105,
            "right": 755,
        }
    }
    
}
REF_RESOLUTION = Resolution(1920, 1080)

PREDICTED_STATS = {
    'team-1': {
        'towers': 0,
        'gold': 0
    },
    'team-2': {
        'towers': 0,
        'gold': 0
    }
}

PSM_MODE = 7
OEM_MODE = 3 
SAVE_SCREENSHOT = False

class ScreenRecognition:
    def __init__(self):
        pass

    def getDataPrediction(self):
        league_window = gw.getWindowsWithTitle(
            "League of Legends (TM) Client")[0]

        league_pos = {
            "left": league_window.left,
            "top": league_window.top,
            "right": league_window.right,
            "bottom": league_window.bottom
        }

        monitor_resolution = Resolution(
            get_monitors()[0].width, get_monitors()[0].height)
        league_resolution = Resolution(
            monitor_resolution.x - league_pos["left"] * 2, monitor_resolution.y - league_pos["top"] * 2)

        print(f"Monitor resolution: {monitor_resolution}")
        print(f"League resolution: {league_resolution}")

        for i in range(2):
            for x in ["towers", "gold"] if i == 0 else ["gold", "towers"]:
                ref_offsets = REF_OFFSETS[f"team-{i}"][x]
                
                #? Linear transformation (not working)
                # x_left_offset, y_offset =  xy_linear_transformation(REF_RESOLUTION, league_resolution, ref_offsets["left"], ref_offsets["height"])
                # x_right_offset, y_offset =  xy_linear_transformation(REF_RESOLUTION, league_resolution, ref_offsets["left"], ref_offsets["height"])
                
                #? Non-linear transformation (not working)
                # x_left_offset, y_offset = xy_nonlinear_transformation((ref_offsets["left"], REF_HEIGHT_OFFSETS[f"{REF_RESOLUTION.x}x{REF_RESOLUTION.y}"]))
                # x_right_offset, y_offset = xy_nonlinear_transformation((ref_offsets["right"], REF_HEIGHT_OFFSETS[f"{REF_RESOLUTION.x}x{REF_RESOLUTION.y}"]))

                x_left_offset = ref_offsets["left"]
                x_right_offset = ref_offsets["right"]
                y_offset = 1010

                data_pos = {
                    "left": league_pos['left'] + x_left_offset,
                    "top": league_pos["top"],
                    "right": league_pos["right"] - x_right_offset,
                    "bottom": league_pos["bottom"] - y_offset
                }

                screenshot = ImageGrab.grab(bbox=(data_pos["left"], data_pos["top"],
                                            data_pos["right"], data_pos["bottom"]), all_screens=True)
                
                filtered_img = preprocess_img(screenshot)

                if SAVE_SCREENSHOT: save_screenshot(filtered_img, league_resolution)
                
                text = pytesseract.image_to_string(
                        filtered_img, config=f'--psm {PSM_MODE} --oem {OEM_MODE} -c tessedit_char_whitelist=0123456789Oo.kK').strip()

                text = text.replace('O', '0').replace('o', '0')
                PREDICTED_STATS[f"team-{i + 1}"][x] = text

        return PREDICTED_STATS
    
def xy_linear_transformation(ref_resolution: Resolution, new_resolution: Resolution, x_position, y_position):
    if ref_resolution.x == new_resolution.x and ref_resolution.y == new_resolution.y:
        return x_position, y_position
    
    ref_aspect_ratio = ref_resolution.x / ref_resolution.y
    new_aspect_ratio = new_resolution.x / new_resolution.y

    print(f"Reference aspect ratio: {ref_aspect_ratio}")
    print(f"New aspect ratio: {new_aspect_ratio}")

    if new_aspect_ratio >= ref_aspect_ratio:
        #  New screen is wider than previous. Use full height; effective width is based on previous ratio.
        print(f"The new resolution is wider or equal than reference resolution.")
        
        effectiveWidth = new_resolution.y * ref_aspect_ratio
        horizontalOffset = (new_resolution.x - effectiveWidth) / 2
        
        new_x =  (x_position / ref_resolution.x) * effectiveWidth + horizontalOffset
        new_y = (y_position / ref_resolution.y) * new_resolution.y
        return new_x, new_y
    elif new_aspect_ratio < ref_aspect_ratio:
        #  New screen is taller than previous. Use full width; effective height is based on previous ratio.
        print(f"The new resolution is taller than reference resolution.")
        
        effectiveHeight = new_resolution.x / ref_aspect_ratio
        verticalOffset = (new_resolution.x - effectiveHeight) / 2
        
        new_x = (x_position / ref_resolution.x) * new_resolution.x
        new_y =  (y_position / ref_resolution.x) * effectiveHeight + verticalOffset
        return new_x, new_y
    else:
        return 0, 0    

def xy_nonlinear_transformation(point):
    return TPS.inverse(point)

def preprocess_img(img):
    img_arr = np.array(img, dtype=np.uint8)
    filtered_arr = img_arr
    
    filtered_arr = np.full_like(img_arr, 255, dtype=np.uint8)
    
    r, g, b = img_arr[:,:,0], img_arr[:,:,1], img_arr[:,:,2]
    red_mask = (r > g) & (r > b) & (r > 150) & (g < 100)
    blue_mask = (b > r) & (b > g) & (b > 170)

    filtered_arr[red_mask, :] = img_arr[red_mask, :]
    filtered_arr[blue_mask, :] = img_arr[blue_mask, :]
    filtered_arr[red_mask] = 0
    filtered_arr[blue_mask] = 0

    filtered_arr = cv2.cvtColor(filtered_arr, cv2.COLOR_BGR2GRAY)

    filtered_img = Image.fromarray(filtered_arr)
    return filtered_arr

# I think there is kinda of an error here
def test_models():
    model_results = {}
    correct_texts = ["0", "33.8k", "9", "28", "41.9k", "3"]

    image_paths = glob.glob('src/screen_recognition/screenshots/*.png')

    for i in range(50):
        for path in image_paths:
            filename = os.path.basename(path)
            model_results.setdefault(filename, {})

            screenshot = Image.open(path).convert('RGB')
            filtered_img = preprocess_img(screenshot)

            for psm_mode in range(14):
                for oem_mode in range(4):
                    model_results[filename].setdefault(f"psm={psm_mode}", {})
                    try:
                        model_results[filename][f"psm={psm_mode}"].setdefault(f"oem={oem_mode}", {})

                        print(f"Predicting with model psm={psm_mode} and oem={oem_mode}")

                        configs = f"""
                        --psm {psm_mode} --oem {oem_mode} -c
                        tessedit_char_whitelist=0123456789
                        classify_bln_numeric_mode=1
                        load_system_dawg=0
                        load_freq_dawg=0 
                        load_unambig_dawg=0
                        load_punc_dawg=0
                        preserve_interword_spaces=1
                        """

                        text = pytesseract.image_to_string(
                            filtered_img, config=configs).strip()

                        text = text.replace('O', '0').replace('o', '0')
                        
                        model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"].setdefault("words_counted", 0)
                        
                        for word in text.split():
                            model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"]["words_counted"] += 1
                            
                            if word in correct_texts:
                                print(f"Matched word: {word}")
                                model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"].setdefault(word, 0)
                                model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"][word] += 1 
                            else:
                                model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"].setdefault("error", 0)
                                model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"]["error"] += 1
                    except Exception:
                        model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"].setdefault("error", 0)
                        model_results[filename][f"psm={psm_mode}"][f"oem={oem_mode}"]["error"] += 1
                        continue
                                
    return model_results

def save_screenshot(screenshot, cur_resolution: Resolution):
    saving_path = f"src/screen_recognition/screenshots/screenshot-{cur_resolution.x}x{cur_resolution.y}.png"
    screenshot.save(saving_path)

def local_class_test():
    screen_recognition = ScreenRecognition()
    prediction = screen_recognition.getDataPrediction()

    print(json.dumps(prediction, indent=3))
    
    plt.show()

