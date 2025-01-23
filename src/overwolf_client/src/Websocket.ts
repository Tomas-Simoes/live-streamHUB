class Websocket{
  private socket: WebSocket

  constructor(url: string) {
    this.socket = new WebSocket(url);  

    
    this.socket.addEventListener("open", (event) => {
      console.log("WebSocket connection established.")
      this.socket.send("WebSocket connection established. ")
    })

    this.socket.addEventListener("message", (event) => {
      console.log("Message received: ", event.data)
    })
      
  }

  public sendMessage(message: string): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      console.error('WebSocket is not open. Unable to send message.');
    }
  }
}

export default Websocket;