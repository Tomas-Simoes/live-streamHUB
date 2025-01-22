import json
import asyncio
from enum import Enum
from util.Logging import logger


class Endpoint(Enum):
    LIVE_EVENTS = "/liveclientdata/eventdata"
    PLAYER_LIST = "/liveclientdata/playerlist"
    ALL_DATA = "/liveclientdata/allgamedata"


class GameClient:
    previous_data = {}

    def __init__(self, httpClient):
        self.httpClient = httpClient

    async def getAllData(self):
        return await self.getData([Endpoint.ALL_DATA])

    async def getLiveEvents(self):
        data = await self.getData([Endpoint.LIVE_EVENTS])

        if data is None:
            logger.warning("No data is available, check if game is running")
            return None

        event_data = data[0].get('Events')

        if not event_data[-1] == self.previous_data:
            self.previous_data = event_data[-1]

            return self.previous_data

    async def getData(self, endpoints):
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
            logger.error(
                f"An error occurred while fetching live data: {e}")
        
        return None

    def save_to_file(self, data):
        with open("data/game.json", "w") as json_file:
            json.dump(data, json_file, indent=4)
