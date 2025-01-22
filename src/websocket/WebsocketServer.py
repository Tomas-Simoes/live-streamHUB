import asyncio
import json
import websockets as ws
from websockets.exceptions import ConnectionClosedOK


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

            print(message)

    async def send_data(self, data):
        if self.websocket:
            if not isinstance(data, (str, bytes)):
                data = json.dumps(data)

            print("Sending data to client.")
            await self.websocket.send(data)

    async def start_connection(self):
        async with ws.serve(self.handler, "localhost", 8001, ping_interval=None):
            await asyncio.Future()  # listens forever
