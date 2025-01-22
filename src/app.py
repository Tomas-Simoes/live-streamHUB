from http_client.HttpClient import HttpClient
from riot_client.GameClient import GameClient, Endpoint
from websocket.WebsocketServer import WebsocketServer
from util.Logging import logger

import asyncio
BASE_URI = 'https://127.0.0.1:2999'

client = GameClient(HttpClient({"baseURI": BASE_URI}))
ws_server = WebsocketServer()


async def main():
    asyncio.create_task(ws_server.start_connection())

    while True:
        logger.info("Fetching data from game...")
        data = await client.getLiveEvents()
        
        if data is not None:
            logger.info(f"New data was fetched: {data}")
            await ws_server.send_data(data)

        await asyncio.sleep(7)

asyncio.run(main())
