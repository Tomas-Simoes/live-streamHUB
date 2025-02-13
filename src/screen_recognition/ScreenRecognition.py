import pygetwindow as gw

from PIL import ImageGrab, Image
from collections import namedtuple
import pytesseract 

class ScreenRecognition:
  def __init__(self):
    pass
  
  def getWindowPosition(self):
    league_window = gw.getWindowsWithTitle("League of Legends (TM) Client")[0]
    Resolution = namedtuple('Resolution', ['x', 'y'])

    ref_resolution = Resolution(1280, 720)
    monitor_resolution = Resolution(1920, 1080)

    league_pos = {
      "left": league_window.left,
      "top": league_window.top,
      "right": league_window.right,
      "bottom": league_window.bottom
    }
    
    cur_resolution = Resolution(monitor_resolution.x - league_pos["left"] * 2, monitor_resolution.y - league_pos["top"] * 2)

    ref_x_offset = 260
    ref_y_offset = 670

    # 260
    # 670

    cur_x_offset = ref_x_offset + ((cur_resolution.x - ref_resolution.x) / 2) - ((cur_resolution.y - ref_resolution.y) / 2)
    cur_y_offset = ref_y_offset + ((cur_resolution.y - ref_resolution.y)) 
    error_y = 10

    if ref_resolution == cur_resolution:
      cur_x_offset == ref_x_offset

    cur_x_l_offset = 800
    cur_x_r_offset = 1050

    scoreboard_pos = {
      "left": league_pos['left'] + cur_x_l_offset,
      "top": league_pos["top"],
      "right": league_pos["right"] - cur_x_r_offset,
      "bottom": league_pos["bottom"]  - cur_y_offset + error_y
    }

    print(f"League position: {league_pos}")
    print(f"Scoreboard position: {scoreboard_pos}")
    
    screenshot = ImageGrab.grab(bbox=[scoreboard_pos["left"], scoreboard_pos["top"], scoreboard_pos["right"], scoreboard_pos["bottom"]], all_screens=True)
    
    saving_path = f"src/screen_recognition/screenshots/screenshot-{cur_resolution.x}x{cur_resolution.y}.png"
    screenshot.save(saving_path)
    text = pytesseract.image_to_string(screenshot, config=r'--psm 6 -c tessedit_char_whitelist=0123456789.')

screen_recognition = ScreenRecognition()
screen_recognition.getWindowPosition()