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
    upperWebsocket.send("Message received from Upper Scoreboard Webclient: " + event.data)
    
    updateUpperScoreboard(JSON.parse(event.data))
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