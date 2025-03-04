let drakeAnnouncer, baronAnnouncer, elderAnnouncer

document.addEventListener("DOMContentLoaded", () => {
  const announcerWebsocket = new WebSocket("ws://localhost:8080/webclient/announcer");

  drakeAnnouncer = document.getElementById("drake-announcer");
  baronAnnouncer = document.getElementById("baron-announcer");
  elderAnnouncer = document.getElementById("elder-announcer");

  announcerWebsocket.onopen = () => {
    console.log("Announcer Webclient connected at \"ws://localhost:8080/webclient/announcer\"");
    announcerWebsocket.send("Announcer Webclient connected connected at \"ws://localhost:8080/webclient/announcer\"")
  };

  announcerWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);

    if(receivedData.latency_data) {
      let latency_data = receivedData.latency_data
      
      latency_data.webclient_timestamp = Date.now() / 1000

      let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
      let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
      let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
      let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

       // Send the latency information back through the WebSocket
       announcerWebsocket.send(`Announcer Webclient received: OW-WS in ${overwolfToWebSocket.toFixed(3)}s -> WS-DP in ${webSocketToDataProcessor.toFixed(3)}s -> DP-WC in ${dataProcessorToWebClient.toFixed(3)}s (total: ${totalLatency.toFixed(3)}s)`);
    }
    
    if(receivedData.data) {
      updateAnnouncer(receivedData.data)
    }
  };
})

function updateAnnouncer(announcerType){
  switch (announcerType.toLowerCase()) {
    case "baron":
      showAndHide(baronAnnouncer, announcerType)
      break
    case "elder":
      showAndHide(elderAnnouncer, announcerType)
      break
    default:
      showAndHide(drakeAnnouncer, announcerType)
      break
  }
}

function showAndHide(announcer, type){
  
  if (!announcer) {
    console.error(`Announcer element for ${type} not initialized!`);
    return;
  }
  
  announcer.textContent = type
  announcer.style.visibility = 'visible'
  
  setTimeout(() => {
      announcer.style.visibility = 'hidden'
    }, 10000)
}