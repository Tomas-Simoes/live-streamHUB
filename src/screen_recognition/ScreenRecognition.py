from screeninfo import get_monitors
from collections import namedtuple
from PIL import ImageGrab
from skimage.transform import ThinPlateSplineTransform

import pygetwindow as gw
import pytesseract
import numpy as np
import matplotlib.pyplot as plt


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
            'height': 1000
        },
        'gold': {
            "left": 1105,
            "right": 755,
            'height': 1000
        }
    }
    
}

REF_HEIGHT_OFFSETS = {
    "1920x1080": 1006,
    "1680x1050": 978
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

SAVE_SCREENSHOT = False
TPS = ThinPlateSplineTransform()

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
        
        src_points = []
        dst_points = []
        for x in range(1, 100):
            src_points.append((round(x/100 * REF_RESOLUTION.x, 4), REF_HEIGHT_OFFSETS[f"{REF_RESOLUTION.x}x{REF_RESOLUTION.y}"]))
            dst_points.append((round(x/100 * league_resolution.x, 4), REF_HEIGHT_OFFSETS[f"{league_resolution.x}x{league_resolution.y}"]))

        TPS.estimate(np.array(src_points), np.array(dst_points))

        for i in range(2):
            for x in ["gold"]:
                ref_offsets = REF_OFFSETS[f"team-{i}"][x]
                
                #? Linear transformation (not working)
                #x_left_offset, y_offset =  xy_linear_transformation(REF_RESOLUTION, league_resolution, ref_offsets["left"], ref_offsets["height"])
                #x_right_offset, y_offset =  xy_linear_transformation(REF_RESOLUTION, league_resolution, ref_offsets["left"], ref_offsets["height"])
                
                #? Non-linear transformation (not working)
                x_left_offset, y_offset = xy_nonlinear_transformation((ref_offsets["left"], REF_HEIGHT_OFFSETS[f"{REF_RESOLUTION.x}x{REF_RESOLUTION.y}"]))
                x_right_offset, y_offset = xy_nonlinear_transformation((ref_offsets["right"], REF_HEIGHT_OFFSETS[f"{REF_RESOLUTION.x}x{REF_RESOLUTION.y}"]))

                data_pos = {
                    "left": league_pos['left'] + x_left_offset,
                    "top": league_pos["top"],
                    "right": league_pos["right"] - x_right_offset,
                    "bottom": league_pos["bottom"] - y_offset
                }

                #print(
                #    f"Screenshot at: {data_pos} with offsets {x_left_offset} and {x_right_offset}")
                screenshot = ImageGrab.grab(bbox=(data_pos["left"], data_pos["top"],
                                            data_pos["right"], data_pos["bottom"]), all_screens=True)

                screenshot.show()

                if SAVE_SCREENSHOT: save_screenshot(screenshot, league_resolution)

            text = pytesseract.image_to_string(
                screenshot, config=r'--psm 6 --oem 3 -c tessedit_char_whitelist=0123456789Oo.kK').strip()

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

def save_screenshot(screenshot, cur_resolution: Resolution):
    saving_path = f"src/screen_recognition/screenshots/screenshot-{cur_resolution.x}x{cur_resolution.y}.png"
    screenshot.save(saving_path)

def local_class_test():
    screen_recognition = ScreenRecognition()
    screen_recognition.getDataPrediction()


local_class_test()
