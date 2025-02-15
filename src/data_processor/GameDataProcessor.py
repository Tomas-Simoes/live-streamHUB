import json
import os
import asyncio
import re
import traceback

from enum import Enum
from util.Logging import logger
from websocket.WebsocketServer import WebsocketServer
from deepdiff import DeepDiff


class Endpoint(Enum):
    EVENTS = "/liveclientdata/eventdata"
    PLAYER_LIST = "/liveclientdata/playerlist"
    ALL_DATA = "/liveclientdata/allgamedata"


class GameDataProcessor:
    DATA_DIR = "src/data_processor/data/"
    OW_CLOCK_DIR = DATA_DIR + "OW_clock.json"
    OW_EVENTS_DIR = DATA_DIR + "OW_events.json"
    OW_CHAT_DIR = DATA_DIR + "OW_chat.json"
    OW_PLAYERS_DIR = DATA_DIR + "OW_players.json"

    LCAPI_ALLDATA_DIR = DATA_DIR + "LCAPI_alldata.json"
    LCAPI_EVENTS_DIR = DATA_DIR + "LCAPI_events.json"

    DEFAULT_DIR = DATA_DIR + "default_data.json"

    SAVE_TO_FILE = True
    GET_OWDATA = True
    GET_LCAPIDATA = False

    CURR_PLAYER_DATA = {}

    def __init__(self, httpClient):
        self.httpClient = httpClient
        self.wss = WebsocketServer()

    # Handles data that comes from Overwolf APP
    async def handleOWData(self, json_data):
        if not json_data:
            logger.warning("No data was fetched from Overwolf.")
            return

        if not self.GET_OWDATA:
            return

        original_json = json_data

        for key in json_data.keys():
            save_dir = self.DEFAULT_DIR
            append_to_file = True

            json_data = original_json
            json_data = json_data[key]

            print(json_data)

            try:
                match key:
                    case "match_clock":
                        save_dir = self.OW_CLOCK_DIR
                        primary_key = next(iter(json_data))

                        event_type = json_data.get(primary_key, {})[
                            0].get("name")
                        event_data = json_data.get(primary_key, {})[
                            0].get("data")

                        json_data = {
                            'data': event_data
                        }
                        await self.wss.send_data(json_data, 'webclient', 'timer')

                    case "all_players":
                        save_dir = self.OW_PLAYERS_DIR

                        # Only for formatting
                        players_data = json.loads(json_data["all_players"])
                        json_data["all_players"] = players_data

                        players_filtered_data = []
                        player_index = 0
                        for player in players_data:
                            players_filtered_data.append({
                                "champion": player["championName"],
                                "raw_champion": player['rawChampionName'],
                                "items": [],
                                "position": player["position"],
                                "runes": player["runes"],
                                "scores": player["scores"]
                            })

                            for item in player['items']:
                                players_filtered_data[player_index]["items"].append({
                                    "name": item["displayName"],
                                    "raw_name": ''.join(filter(str.isdigit, item["rawDisplayName"]))
                                })

                            player_index += 1

                        isPlayerDataEmpty = len(self.CURR_PLAYER_DATA) == 0

                        # TODO Remove this line for only update the diference between the last scoreboard
                        isPlayerDataEmpty = True

                        if self.CURR_PLAYER_DATA == players_filtered_data and not isPlayerDataEmpty:
                            logger.info("Didn't got new players information.")
                        else:
                            diff = DeepDiff(self.CURR_PLAYER_DATA,
                                            players_filtered_data)

                            logger.info(
                                f"New players information received. Sending it now...")
                            sent_data = await self.wss.send_data(players_filtered_data if isPlayerDataEmpty else diff, "webclient", "scoreboard")

                            if sent_data:
                                self.CURR_PLAYER_DATA = players_filtered_data

                    case "chat":
                        for chat_json in json_data:
                            chat_event = chat_json['events'][0]['data'].lower()

                            if ('stolen' in chat_event or 'slain' in chat_event):
                                event_keywords = [
                                    'baron', 'voidgrubs', 'atakhan', 'drake', 'herald']

                                for keyword in event_keywords:
                                    if keyword in chat_event:
                                        if keyword == 'drake':
                                            # removes all non-alphanumeric characters
                                            clean_chat_event = re.sub(
                                                r'[^\w\s]', '', chat_event)
                                            drake_type = " ".join(
                                                clean_chat_event.split()[-2:])

                                            json_data["data"] = drake_type
                                        else:
                                            json_data["data"] = keyword

                                        logger.debug(
                                            f"{json_data['data']} has been slain.")
                                        await self.wss.send_data(json_data, 'webclient', 'announcer')

                if self.SAVE_TO_FILE:
                    self.save_to_file(json_data, save_dir, append_to_file)

                logger.debug(
                    f"Data ({key}) received from Overwolf. {'Saved to file ' + save_dir + '.' if self.SAVE_TO_FILE else ''}")

            except Exception as e:
                logger.error(f"Error receiving data from Overwolf: {e}")
                logger.error(traceback.format_exc())

    # Handles data that comes from League Live Client API
    def handleLCAPIData(self, json_data, save_dir):
        if self.SAVE_TO_FILE:
            self.save_to_file(json_data, save_dir)

        if json_data is None:
            logger.warning("No data is available, check if game is running")
            return None

        logger.debug(
            f"Data received from Live Client API. {"Saved to file" if self.SAVE_TO_FILE else ""}")

    # Gets data from Live Client API. Supports multiple endpoints fetching at same time
    async def requestEndpoints(self, endpoints):
        if not self.GET_LCAPIDATA:
            return

        try:
            for endpoint in endpoints:
                if not isinstance(endpoint, Endpoint):
                    raise ValueError(
                        "endpoint at getData(endpoint) must be of type Endpoint.")

            data_task = asyncio.create_task(
                self.httpClient.async_get(endpoints))

            logger.info("Waiting for data to be fetched...")
            return await data_task
        except Exception as e:
            logger.error(f"Error receiving data from Live Client API: {e}")

        return None

    def save_to_file(self, json_data, filename=DEFAULT_DIR, append_to_file=True):
        if not os.path.exists(os.path.dirname(filename)):
            os.makedirs(os.path.dirname(filename))

        if os.path.exists(filename):
            with open(filename, "r") as file:
                existing_data = json.load(file)
        else:
            existing_data = []

        if append_to_file:
            existing_data.append(json_data)
        else:
            existing_data = json_data

        # Write the updated data back to the file
        with open(filename, "w") as file:
            json.dump(existing_data, file, indent=4)
