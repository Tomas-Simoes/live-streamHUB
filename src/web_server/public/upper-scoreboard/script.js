import { SPAWN_INFO } from "/timers/script.js";
let team1_elements, team2_elements

document.addEventListener("DOMContentLoaded", () => {
  team1_elements = document.querySelectorAll("#upper_team1 > *")
  team2_elements = document.querySelectorAll("#upper_team2 > *")

  const upperWebsocket = new WebSocket("ws://localhost:8080/webclient/upper-scoreboard");

  upperWebsocket.onopen = () => {
    console.log("Upper Scoreboard Webclient connected at \"ws://localhost:8080/webclient/upper-scoreboard\"");
    upperWebsocket.send("Upper Scoreboard Webclient connected at \"ws://localhost:8080/webclient/upper-scoreboard\"")
  };

  upperWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);

    if(receivedData.latency_data) {
      let latency_data = receivedData.latency_data
      
      latency_data.webclient_timestamp = Date.now() / 1000

      let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
      let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
      let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
      let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

       // Send the latency information back through the WebSocket
       upperWebsocket.send(`Announcer Webclient received: OW-WS in ${overwolfToWebSocket.toFixed(3)}s -> WS-DP in ${webSocketToDataProcessor.toFixed(3)}s -> DP-WC in ${dataProcessorToWebClient.toFixed(3)}s (total: ${totalLatency.toFixed(3)}s)`);
    }
    
    if(receivedData.data) {
      updateUpperScoreboard(receivedData.data)
    }
  };
})

function updateUpperScoreboard(json_data) {
  for (let i = 1; i <= 2; i++) {
    let team_elements = i == 1 ? team1_elements : team2_elements
    
    team_elements.forEach(element => {
      console.log(element)
      let el_id = (element.id).replace(`_team${i}`, '')

      switch (el_id) {
        case 'towers':
        case 'gold':
          element.textContent = json_data[`team-${i}`][el_id]
          break;
        default:
          console.log(el_id)
          console.log(SPAWN_INFO)
          element.textContent = SPAWN_INFO[el_id]['times_killed']
          break;
      }
    });
  }
}