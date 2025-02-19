from screeninfo import get_monitors
from collections import namedtuple
from turtle import Screen
from PIL import ImageGrab, Image

import numpy as np
import pygetwindow as gw
import pytesseract
import win32gui

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
    'team-1': {
        'towers': 0,
        'gold': 0
    },
    'team-2': {
        'towers': 0,
        'gold': 0
    }
}


class ScreenRecognition:
    def __init__(self):
        pass

    def getDataPrediction(self):
        Resolution = namedtuple('Resolution', ['x', 'y'])
        ref_resolution = Resolution(1920, 1200)

        league_window = gw.getWindowsWithTitle(
            "League of Legends (TM) Client")[0]

        league_pos = {
            "left": league_window.left,
            "top": league_window.top,
            "right": league_window.right,
            "bottom": league_window.bottom
        }

        screenshot = ImageGrab.grab(bbox=(league_pos["left"], league_pos["top"],
                                          league_pos["right"], league_pos["bottom"]), all_screens=True).convert('L')
        screenshot.show()

        monitor_resolution = Resolution(
            get_monitors()[0].width, get_monitors()[0].height)
        league_resolution = Resolution(
            monitor_resolution.x - league_pos["left"] * 2, monitor_resolution.y - league_pos["top"] * 2)
        scaling_factor = Resolution(
            league_resolution.x / ref_resolution.x, league_resolution.y / ref_resolution.y)

        print(f"Monitor resolution: {monitor_resolution}")
        print(f"League position: {league_pos}")
        print(f"League resolution: {league_resolution}")
        print(f"Scaling factor: {scaling_factor}")
        for i in range(2):
            for x in ["gold"]:
                cur_x_l_offset = (REF_OFFSETS[f"team-{i}"][x]['left'] *
                                  scaling_factor.x)
                cur_x_r_offset = REF_OFFSETS[f"team-{i}"][x]['right'] * \
                    scaling_factor.x

                cur_y_offset = 1045 * scaling_factor.y

                cur_x_l_offset = REF_OFFSETS[f"team-{i}"][x]['left'] + \
                    ((league_resolution.x - ref_resolution.x) / 2) - \
                    ((league_resolution.y - ref_resolution.y) / 2)

                cur_x_r_offset = REF_OFFSETS[f"team-{i}"][x]['right'] + \
                    ((league_resolution.x - ref_resolution.x) / 2) - \
                    ((league_resolution.y - ref_resolution.y) / 2)

                cur_y_offset = 1045 + \
                    ((league_resolution.y - ref_resolution.y))

                data_pos = {
                    "left": league_pos['left'] + 666,
                    "top": league_pos["top"],
                    "right": league_pos["right"],
                    "bottom": league_pos["bottom"]
                }

                print(
                    f"Screenshot at: {data_pos} with offsets {cur_x_l_offset} and {cur_x_r_offset}")
                screenshot = ImageGrab.grab(bbox=(data_pos["left"], data_pos["top"],
                                            data_pos["right"], data_pos["bottom"]), all_screens=True)

                screenshot.show()
            # arr_ss = np.array(screenshot)
            # arr_ss = (arr_ss > 40) * 255

            # screenshot = Image.fromarray(arr_ss.astype(np.uint8))

            text = pytesseract.image_to_string(
                screenshot, config=r'--psm 6 --oem 3 -c tessedit_char_whitelist=0123456789Oo.kK').strip()

            text = text.replace('O', '0').replace('o', '0')

            PREDICTED_STATS[f"team-{i + 1}"][x] = text

        return PREDICTED_STATS

    # saving_path = f"src/screen_recognition/screenshots/screenshot-{cur_resolution.x}x{cur_resolution.y}.png"
    # screenshot.save(saving_path)


# def x_transformation(x, y, x_scale_factor, y_scale_factor):
    # return x * x_scale_factor * (1 - 0.027 * y /)


def local_class_test():
    screen_recognition = ScreenRecognition()
    screen_recognition.getDataPrediction()


local_class_test()
