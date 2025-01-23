import json
import os
import asyncio
from enum import Enum
from util.Logging import logger


class GameClient:
    previous_livedata = {}
    previous_gameinfo = {}
    previous_data = {}

    LIVEDATA_DIR = "src/riot_client/data/livedata.json"
    GAMEINFO_DIR = "src/riot_client/data/gameinfo.json"
    DEFAULT_DIR = "src/riot_client/data/data.json"

    SAVE_TO_FILE = True

    def handleData(self, string_data):
        if not string_data:
            return
        
        try:
            json_data = json.loads(string_data)

            # Formats "live_client_data.all_players_data" to a JSON format, since it's a nested JSON. Use if needed
            if next(iter(json_data)) == "live_client_data":
                all_players_data = json.loads(json_data["live_client_data"]["all_players"])
                json_data["live_client_data"]["all_players"] = all_players_data

            if self.SAVE_TO_FILE:
                self.save_to_file(json_data)
            
            logger.debug(f"Data received: {json.dumps(json_data, indent=4)}")
        except Exception as e:
            logger.error(f"Error receiving data: {e}")

    def save_to_file(self, json_data, filename=DEFAULT_DIR):
        match next(iter(json_data)):
            case "live_client_data":
                filename = self.LIVEDATA_DIR
            case "game_info":
                filename = self.GAMEINFO_DIR

        if not os.path.exists(os.path.dirname(filename)):
            os.makedirs(os.path.dirname(filename))

        if os.path.exists(filename):
            with open(filename, "r") as file:
                existing_data = json.load(file)
        else:
            existing_data = []

        # Append the new data to the existing data list
        existing_data.append(json_data)

        # Write the updated data back to the file
        with open(filename, "w") as file:
            json.dump(existing_data, file, indent=4)

