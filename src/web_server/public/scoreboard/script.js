import { getWebsocketLatency } from "../util/util.js"

//TODO update only the diff between previous and current scoreboard
let players_elements = {
  'team1': {},
  'team2': {}
}

export let KILLS_DATA = {
  "team1": 0,
  "team2": 0
}

let scoreWebsocket 
document.addEventListener("DOMContentLoaded", () => {
  connectWebsocket()

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
  let team1_kills = 0
  let team2_kills = 0

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
      
      if (current_team == 'team1') team1_kills += player.scores.kills
      else team2_kills += player.scores.kills
    })


    if (team1_kills > KILLS_DATA.team1) KILLS_DATA.team1 = team1_kills
    else if(team2_kills > KILLS_DATA.team2) KILLS_DATA.team2 = team2_kills
  }
}

function connectWebsocket() {
  scoreWebsocket = new WebSocket("ws://localhost:8080/webclient/scoreboard");

  scoreWebsocket.onopen = () => {
    console.log("Scoreboard Webclient connected at \"ws://localhost:8080/webclient/scoreboard\"");
    scoreWebsocket.send("Scoreboard Webclient connected connected at \"ws://localhost:8080/webclient/scoreboard\"")
  };

  scoreWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);

    if(receivedData.latency_data) {
       // Send the latency information back through the WebSocket
       scoreWebsocket.send(`Scoreboard Webclient ${getWebsocketLatency(receivedData.latency_data)})`);
    }
    
    if(receivedData.data) {
      updateScoreboard(receivedData.data)
    }
  };
}