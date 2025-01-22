import obswebsocket as obsws


class ObsClient:
    def __init__(self, host="localhost", port=4455, password="secret"):
        self.obsws = obsws(host, port, password, timeout=10)

        print(f"Connecting to OBS WebSocket at {host}:{port}")
        self.obsws.connect()

    def getScenes(self):
        try:
            currScene = self.obsws.call(obsws.requests.GetSceneItemList())
            return currScene
        except Exception as e:
            print(f"An error occured while getting the scene list: {e}")
