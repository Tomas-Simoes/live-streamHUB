let players_elements = {
  'team1': {},
  'team2': {}
}

document.addEventListener("DOMContentLoaded", () => {
  const websocket = new WebSocket("ws://localhost:8080/webclient/scoreboard");

  websocket.onopen = () => {
    console.log("Scoreboard Webclient connected at \"ws://localhost:8080/webclient/scoreboard\"");
    websocket.send("Scoreboard Webclient connected connected at \"ws://localhost:8080/webclient/scoreboard\"")
  };

  websocket.onmessage = (event) => {
    websocket.send("Message received from Scoreboard Webclient: " + event.data) 
    updateScoreboard(JSON.parse(event.data))
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
  console.log(players_elements)

  if (scoreboardData instanceof Array){
    scoreboardData.forEach((player, player_index) => {
      let current_team = player_index < 5 ? "team1" : "team2"
      let current_player_elements = players_elements[current_team][`player-${player_index < 5 ? player_index + 1 : player_index - 4}`]
      
      for (let i = 0; i < player.items.length; i++) {
        console.log(i)
        console.log(player.items.length)
        console.log(current_player_elements.length)
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