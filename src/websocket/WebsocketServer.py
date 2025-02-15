import asyncio
import json
import websockets as ws
from websockets.exceptions import ConnectionClosed
from websockets import ServerConnection
from util.Logging import logger


class WebsocketServer:
    _instance = None

    clients = {
        'webserver': [],
        'webclient': {
            'timer': [],
            'scoreboard': [],
            'announcer': []
        },
        'overwolf': [],
        'app': [],
    }

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)

        return cls._instance

    def __init__(self, game_data_processor=None):
        if not hasattr(self, "initialized"):
            self.websocket = None
            self.game_data_processor = game_data_processor
            self.initialized = True  # Prevent reinitialization

    def set_GameDataProcessor(self, game_data_processor):
        self.game_data_processor = game_data_processor

    async def handler(self, websocket: ServerConnection):
        path = websocket.request.path

        if websocket.request.path == '/':
            return

        path_parts = path.strip("/").split("/")

        if (len(path_parts) < 1 or len(path_parts) > 2):
            logger.error(
                f"Invalid path received: {path_parts}. Closing connection.")
            websocket.close()
            return

        client_name = path_parts[0]
        sub_path = None

        if len(path_parts) == 2:
            sub_path = path_parts[1]

        if client_name not in self.clients or (sub_path and sub_path not in self.clients[client_name]):
            logger.warning(
                f"Trying to register invalid client at /{client_name}/{sub_path}.")
            return

        if not sub_path:
            self.clients[client_name].append(websocket)
            logger.info(
                f"Registered new client at path /{client_name}:{type(self.clients[client_name])}")
        else:
            self.clients[client_name][sub_path].append(websocket)
            logger.info(
                f"Registered new client at path /{client_name}/{sub_path}:{type(self.clients[client_name][sub_path])}")

        self.websocket = websocket
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data)
                except json.JSONDecodeError:
                    logger.message(f"NON-JSON received: {message}")
        except ConnectionClosed:
            pass
        finally:
            logger.warning(f"Removed client at {client_name}/{sub_path}")
            if not sub_path:
                self.clients[client_name].remove(websocket)
            else:
                self.clients[client_name][sub_path].remove(websocket)

    async def process_message(self, message):
        data = message['data']

        match(message['target']):
            case 'webclient/main':
                await self.send_data(json.dumps(data), 'webclient', 'main')
            case "webclient/timer":
                await self.send_data(json.dumps(data), "webclient", "timer")
            case "webclient/announcer":
                await self.send_data(json.dumps(data), "webclient", "announcer")
            case "overwolf":
                await self.send_data(json.dumps(data), "overwolf")
            case "app":
                await self.game_data_processor.handleOWData(data)

    async def send_data(self, data, target, subtarget=""):
        target_sockets = self.get_target_sockets(target, subtarget)

        if not target_sockets:
            return False

        for target_socket in target_sockets:
            if not isinstance(data, (str, bytes)):
                data = json.dumps(data)

            logger.info(f"Sending data to client {target}/{subtarget}.")
            await target_socket.send(data)

        return True

    def get_target_sockets(self, target, subtarget=None):
        if target not in self.clients or (subtarget and subtarget not in self.clients[target]):
            logger.warning(
                F"Trying to send to an invalid target at /{target}/{subtarget}")
            return None

        target_sockets = None

        if not subtarget:
            target_sockets = self.clients[target]
        else:
            target_sockets = self.clients[target][subtarget]

        if len(target_sockets) == 0:
            logger.warning(
                F"Could not find clients for target /{target}/{subtarget}")

        return target_sockets

    async def start_connection(self):
        try:
            async with ws.serve(self.handler, "localhost", 8080, ping_interval=None):
                await asyncio.Future()  # listens forever
        except asyncio.CancelledError:
            logger.info("WebSocket server was canceled.")
        except Exception as e:
            logger.error(f"Error in WebSocket server: {e}")
        finally:
            logger.info("WebSocket server has stopped.")

    # Debugger functions
    def get_client_stats(self):
        stats = {}
        for client_type, connections in self.clients.items():
            if isinstance(connections, dict):  # If the client has subcategories
                stats[client_type] = {
                    sub_type: len(websockets)
                    for sub_type, websockets in connections.items()
                }
            else:  # Directly a list of websockets
                stats[client_type] = len(connections)
        return stats

    def display_client_stats(self):
        stats = self.get_client_stats()
        logger.debug("Active WebSocket connections:")
        for client_type, connections in stats.items():
            if isinstance(connections, dict):  # Subcategories exist
                print(f"- {client_type}:")
                for sub_type, count in connections.items():
                    print(f"  - {sub_type}: {count} connections")
            else:  # Direct count
                print(f"- {client_type}: {connections} connections")
