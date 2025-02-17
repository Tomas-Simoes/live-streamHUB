from data_processor.GameDataProcessor import GameDataProcessor
from screen_recognition.ScreenRecognition import ScreenRecognition
from websocket.WebsocketServer import WebsocketServer
from util.Logging import logger

import asyncio

BASE_URI = 'https://127.0.0.1:2999'

wss = WebsocketServer()
screen_recognition = ScreenRecognition()
game_data_processor = GameDataProcessor(screen_recognition)

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
