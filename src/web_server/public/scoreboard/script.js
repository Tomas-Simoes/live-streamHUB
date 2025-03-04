//TODO update only the diff between previous and current scoreboard


let players_elements = {
  'team1': {},
  'team2': {}
}

document.addEventListener("DOMContentLoaded", () => {
  const scoreWebsocket = new WebSocket("ws://localhost:8080/webclient/scoreboard");

  scoreWebsocket.onopen = () => {
    console.log("Scoreboard Webclient connected at \"ws://localhost:8080/webclient/scoreboard\"");
    scoreWebsocket.send("Scoreboard Webclient connected connected at \"ws://localhost:8080/webclient/scoreboard\"")
  };

  scoreWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);

    if(receivedData.latency_data) {
      let latency_data = receivedData.latency_data
      
      latency_data.webclient_timestamp = Date.now() / 1000

      let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
      let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
      let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
      let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

       // Send the latency information back through the WebSocket
       scoreWebsocket.send(`Scoreboard Webclient received: OW-WS in ${overwolfToWebSocket.toFixed(3)}s -> WS-DP in ${webSocketToDataProcessor.toFixed(3)}s -> DP-WC in ${dataProcessorToWebClient.toFixed(3)}s (total: ${totalLatency.toFixed(3)}s)`);
    }
    
    if(receivedData.data) {
      updateScoreboard(receivedData.data)
    }
  };

  let team1_el = document.querySelector("#team1")
  let team2_el = document.querySelector("#team2")

  for (let i = 1; i <= 2; i++) {
    let team = (i == 1) ? team1_el : team2_el
    let players_el = team.querySelectorAll(':scope > *')

    players_el.forEach((player_element, player_index) => {
      let data_element = player_element.querySelectorAll(':scope > *')

      players_elements[`team${i}`][`player-${player_index + 1}`] = {
          'champion-img': data_element[0],
          'items': data_element[1].querySelectorAll('img'),
          'stats': data_element[2].querySelectorAll('*')
        }
      })
    }
  })


function updateScoreboard(scoreboardData) {
  if (scoreboardData instanceof Array){
    scoreboardData.forEach((player, player_index) => {
      let current_team = player_index < 5 ? "team1" : "team2"
      let current_player_elements = players_elements[current_team][`player-${player_index < 5 ? player_index + 1 : player_index - 4}`]
      
      for (let i = 0; i < player.items.length; i++) {
        if (i == current_player_elements.items.length) {
          break
        }

        let item_img = current_player_elements['items'][i]
        item_img.src = `/images/items/${player.items[i].raw_name}.png`
      }

      current_player_elements['champion-img'].src = `/images/champions/${player.champion}.png`
      current_player_elements['stats'][0].innerText = `${player.scores.kills}/${player.scores.deaths}/${player.scores.assists}`
      current_player_elements['stats'][1].innerText = `${player.scores.creepScore}`
    })
  }
}