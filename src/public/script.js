document.addEventListener("DOMContentLoaded", () => {
  var messageCount = 0
  const websocket = new WebSocket("ws://localhost:80/");

  websocket.onopen = () => {
    console.log("WebSocket connection established.");
    websocket.send("WebSocket connection established.")
  };

  websocket.onmessage = (event) => {
    messageCount++
    console.log("Message " + messageCount + " from server:", event.data);
    
    document.getElementById("data").textContent = "Data received ("+ messageCount +"): " + event.data
    websocket.send("Message received from client.")
  };

  websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  websocket.onclose = () => {
    console.log("WebSocket connection closed.");
  };
  });