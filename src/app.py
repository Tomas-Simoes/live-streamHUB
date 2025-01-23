from riot_client.GameClient import GameClient
from websocket.WebsocketServer import WebsocketServer
from util.Logging import logger

import asyncio
BASE_URI = 'https://127.0.0.1:2999'

game_client = GameClient()
wss = WebsocketServer(game_client)

async def main():
    asyncio.create_task(wss.start_connection())

    while True:
        data = None
        
        if data is not None:
            logger.info(f"New data was fetched: {data}")
            await wss.send_data(data)

        await asyncio.sleep(7)

asyncio.run(main())
