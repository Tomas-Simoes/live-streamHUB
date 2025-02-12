from data_processor.GameDataProcessor import GameDataProcessor
from websocket.WebsocketServer import WebsocketServer
from http_client.HttpClient import HttpClient
from util.Logging import logger

import asyncio

BASE_URI = 'https://127.0.0.1:2999'

http_client = HttpClient({'baseURI': BASE_URI})
wss = WebsocketServer()
game_data_processor = GameDataProcessor(http_client)

wss.set_GameDataProcessor(game_data_processor)

async def main():
    wss_task = asyncio.create_task(wss.start_connection())

    try:
        while True:
            await asyncio.sleep(0.5)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        wss_task.cancel()
        
        try:
            await wss_task
        except asyncio.CancelledError:
            logger.info("WebSocket task successfully canceled.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
