from collections import namedtuple
from PIL import ImageGrab, Image

import numpy as np
import pygetwindow as gw
import pytesseract
import json

REF_OFFSETS = {
    'team-0': {
        'towers': {
            "left": 740,
            "right": 1140
        },
        'gold': {
            "left": 800,
            "right": 1060
        }
    },
    'team-1': {
        'towers': {
            "left": 1180,
            "right": 695
        },
        'gold': {
            "left": 1105,
            "right": 755
        }
    }
}

PREDICTED_STATS = {
    'team-0': {
        'towers': 0,
        'gold': 0
    },
    'team-1': {
        'towers': 0,
        'gold': 0
    }
}


class ScreenRecognition:
    def __init__(self):
        pass

    def getWindowPosition(self):

        league_window = gw.getWindowsWithTitle(
            "League of Legends (TM) Client")[0]
        Resolution = namedtuple('Resolution', ['x', 'y'])

        league_pos = {
            "left": league_window.left,
            "top": league_window.top,
            "right": league_window.right,
            "bottom": league_window.bottom
        }

        ref_resolution = Resolution(1920, 1080)
        monitor_resolution = Resolution(1920, 1080)
        league_resolution = Resolution(
            monitor_resolution.x - league_pos["left"] * 2, monitor_resolution.y - league_pos["top"] * 2)

        for i in range(2):
            for x in ["gold", "towers"]:
                cur_x_l_offset = REF_OFFSETS[f"team-{i}"][x]['left'] + \
                    ((league_resolution.x - ref_resolution.x) / 2) - \
                    ((league_resolution.y - ref_resolution.y) / 2)

                cur_x_r_offset = REF_OFFSETS[f"team-{i}"][x]['right'] + \
                    ((league_resolution.x - ref_resolution.x) / 2) - \
                    ((league_resolution.y - ref_resolution.y) / 2)

                cur_y_offset = 1045 + \
                    ((league_resolution.y - ref_resolution.y))

                data_pos = {
                    "left": league_pos['left'] + cur_x_l_offset,
                    "top": league_pos["top"],
                    "right": league_pos["right"] - cur_x_r_offset,
                    "bottom": league_pos["bottom"] - cur_y_offset
                }

                screenshot = ImageGrab.grab(bbox=(data_pos["left"], data_pos["top"],
                                            data_pos["right"], data_pos["bottom"]), all_screens=True).convert('L')

                # arr_ss = np.array(screenshot)
                # arr_ss = (arr_ss > 40) * 255

                # screenshot = Image.fromarray(arr_ss.astype(np.uint8))

                text = pytesseract.image_to_string(
                    screenshot, config=r'--psm 6 --oem 3 -c tessedit_char_whitelist=0123456789Oo.kK').strip()

                text = text.replace('O', '0').replace('o', '0')

                PREDICTED_STATS[f"team-{i}"][x] = text

        print(f"Predicted text: {json.dumps(PREDICTED_STATS, indent=3)}")

        # saving_path = f"src/screen_recognition/screenshots/screenshot-{cur_resolution.x}x{cur_resolution.y}.png"
        # screenshot.save(saving_path)


screen_recognition = ScreenRecognition()
screen_recognition.getWindowPosition()
