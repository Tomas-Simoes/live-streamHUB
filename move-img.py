import os
import shutil

folder_path = 'C:/Users/tomas/Downloads/dragontail-15.2.1/15.2.1/img/item'  # Replace with your folder's path

# List all files in the folder
for filename in os.listdir(folder_path):
    destination_path = os.path.join("C:/Users/tomas/Desktop/Folders/dev/projects/LOL-API-with-OBS-Integration/src/web_server/public/images/items", filename)
    shutil.move(os.path.join(folder_path, filename), destination_path)
    