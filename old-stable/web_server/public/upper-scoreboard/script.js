import { SPAWN_INFO } from "../timers/script.js";
import { KILLS_DATA } from "../scoreboard/script.js";

let team1_elements, team2_elements
let upperWebsocket

document.addEventListener("DOMContentLoaded", () => {
  connectWebsockets()
  
  team1_elements = Array.from(document.querySelectorAll("#upper_team1 > *"))
  team2_elements = Array.from(document.querySelectorAll("#upper_team2 > *"))
  
  team1_elements.push(document.getElementById("score_team1"))
  team2_elements.push(document.getElementById("score_team2"))
})

function updateUpperScoreboard(json_data) {
  for (let i = 1; i <= 2; i++) {
    let team_elements = i == 1 ? team1_elements : team2_elements

    for (let z = 0; z < team_elements.length; z++) {
      const element = team_elements[z];
      let el_id = (element.id).replace(`_team${i}`, '')
      
      switch (el_id) {
        case 'towers':
        case 'gold':
          let new_data = (json_data[`team-${i}`][el_id]).toLowerCase()
          let old_data = element.textContent

          if (!new_data.includes('k') || !new_data.includes('.')) {
            continue 
          }

          let num_new_data = parseInt(new_data.replace(".", "").replace("k", ""))
          let num_old_data = parseInt(old_data.replace(".", "").replace("k", "")) 
          
          if (num_new_data <= num_old_data - 10 && num_new_data >= num_old_data + 10) {
            console.log("Discarted new data: " + new_data)
            continue
          }

          element.textContent = new_data
          break;
        case "score":
          element.textContent = KILLS_DATA[`team${i}`]
          break;
        default:
          element.textContent = SPAWN_INFO[el_id]['times_killed']
          break;
      }
    }
  }
}

function connectWebsockets() {
  upperWebsocket = new WebSocket("ws://localhost:8080/webclient/upper-scoreboard");

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
}