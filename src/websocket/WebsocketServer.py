import asyncio
import json
import websockets as ws
from websockets.exceptions import ConnectionClosedOK
from util.Logging import logger

class WebsocketServer:
    def __init__(self):
        self.websocket = None

    async def handler(self, websocket):
        self.websocket = websocket
        await self.receive_data(websocket)

    async def receive_data(self, websocket):
        while True:
            try:
                message = await websocket.recv()
            except ConnectionClosedOK:
                break

    async def send_data(self, data):
        if self.websocket:
            if not isinstance(data, (str, bytes)):
                data = json.dumps(data)

            logger.info("Sending data to client.")
            await self.websocket.send(data)

    async def start_connection(self):
        async with ws.serve(self.handler, "localhost", 80, ping_interval=None):
            await asyncio.Future()  # listens forever
