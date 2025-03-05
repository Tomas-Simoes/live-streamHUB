import { IMG_PATH } from "../util/util.js"

let DRAKE_SPAWNTIME = minToSeconds(5)
const DRAKE_AFTERKILL = minToSeconds(5)
const DRAKE_MAXRESPAWN = 4

let HERALD_SPAWNTIME = minToSeconds(16)

let VOIDGRUB_SPAWNTIME = minToSeconds(6)
const VOIDGRUB_AFTERKILL = minToSeconds(4)

let BARON_SPAWNTIME = minToSeconds(25 )
const BARON_AFTERKILL = minToSeconds(6)

let ATAKHAN_SPAWNTIME = minToSeconds(20)

let ELDER_SPAWNTIME = minToSeconds(6)
const ELDER_AFTERKILL = minToSeconds(6)

export const SPAWN_INFO = {
  "drake": {
    "was_killed": false,
    "times_killed": 0,
  },
  "herald": {
    "was_killed": false,
    "times_killed": 0,
  },
  "voidgrubs": {
    "times_killed": 0,
  },
  "atakhan": {
    "was_killed": false,
    "times_killed": 0,
  },
  "elder": {
    "was_killed": false,
  }
};

let left_timer, left_bottom_timer, right_timer, matchSeconds
let isTimerVisible = false

document.addEventListener("DOMContentLoaded", () => {
  const timerWebsocket = new WebSocket("ws://localhost:8080/webclient/timer");
  const announcerWebsocket = new WebSocket("ws://localhost:8080/webclient/announcer")

  left_fig = document.getElementById("left-fig")
  left_bottom_fig = document.getElementById("left-down-fig")
  right_fig = document.getElementById("right-fig")
  
  left_timer = {
    'text': left_fig.querySelector("figcaption"),
    'img': left_fig.querySelector("img"),
    'changeVisibility': (visibility) => changeElementVisibility(left_timer, visibility)
  }

  left_bottom_timer = {
    'text': left_bottom_fig.querySelector("figcaption"),
    'img': left_bottom_fig.querySelector("img"),
    'changeVisibility': (visibility) => changeElementVisibility(left_bottom_timer, visibility)
  }
  
  right_timer = {
    'text': right_fig.querySelector("figcaption"),
    'img': right_fig.querySelector("img"),
    'changeVisibility': (visibility) => changeElementVisibility(right_timer, visibility)
  }
  
  left_timer.changeVisibility('hidden')
  left_bottom_timer.changeVisibility('hidden')
  right_timer.changeVisibility('hidden')

  timerWebsocket.onopen = () => {
    console.log("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"");
    timerWebsocket.send("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"")
  };

  timerWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);

    if(receivedData.latency_data) {
      let latency_data = receivedData.latency_data
      
      latency_data.webclient_timestamp = Date.now() / 1000

      let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
      let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
      let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
      let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

       // Send the latency information back through the WebSocket
       timerWebsocket.send(`Timer Webclient received: OW-WS in ${overwolfToWebSocket.toFixed(3)}s -> WS-DP in ${webSocketToDataProcessor.toFixed(3)}s -> DP-WC in ${dataProcessorToWebClient.toFixed(3)}s (total: ${totalLatency.toFixed(3)}s)`);
    }
    
    if(receivedData.data) {
      updateTimers(receivedData.data)
    }
  };

  announcerWebsocket.onopen = () => {
    console.log("Timer Webclient connected at \"ws://localhost:8080/webclient/announcer\"");
    announcerWebsocket.send("Timer Webclient connected at \"ws://localhost:8080/webclient/announcer\"")
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
       announcerWebsocket.send(`Timer Webclient received in OW-WS${overwolfToWebSocket} / WS-DP${webSocketToDataProcessor} / DP-WC${dataProcessorToWebClient} (total: ${totalLatency})`);
    }
    
    if(receivedData.data) {
      handleAnnouncer(receivedData.data)
    }
  };
})

function changeElementVisibility(element, visibility) {
  element.text.style.visibility = visibility
  element.img.style.visibility = visibility
}

function updateTimers(newMatchSeconds){
  matchSeconds = newMatchSeconds
  
  let showDrakeSpawn = SPAWN_INFO['drake']['times_killed'] < DRAKE_MAXRESPAWN
  let showVoidgrubSpawn = SPAWN_INFO['voidgrubs']['times_killed'] < 2 && matchSeconds < HERALD_SPAWNTIME - VOIDGRUB_AFTERKILL
  let showHeraldSpawn = !showVoidgrubSpawn || (!SPAWN_INFO['herald']['was_killed'] && matchSeconds > HERALD_SPAWNTIME - minToSeconds(4))
  let showBaronSpawn = !showHeraldSpawn || (matchSeconds > BARON_SPAWNTIME - minToSeconds(4) && matchSeconds > HERALD_SPAWNTIME + minToSeconds(1))
  let showAtkhan = matchSeconds >= ATAKHAN_SPAWNTIME - minToSeconds(10) && !SPAWN_INFO['atakkan']['was_killed']
  
  left_timer.changeVisibility(showVoidgrubSpawn || showHeraldSpawn || showBaronSpawn ? 'visible' : 'hidden')
  left_bottom_timer.changeVisibility(showAtkhan ? 'visible' : 'hidden')
  
  right_timer.changeVisibility(showDrakeSpawn ? 'visible' : 'hidden')

  if (showDrakeSpawn){
    //TODO figure out how will I know the specific drake (ocean, mountain etc...)
    let next_drake = DRAKE_SPAWNTIME - matchSeconds
    
    right_timer.img.src = IMG_PATH.cloud
    right_timer.text.textContent = (next_drake < 0 ? 'Alive' : secondsToMin(next_drake)) 
  } else {
    let next_elder = ELDER_SPAWNTIME - matchSeconds
    
    right_timer.img.src = IMG_PATH.elder
    right_timer.text.textContent = (next_elder < 0 ? 'Alive' : secondsToMin(next_elder)) 
  }


  if(showVoidgrubSpawn && !showHeraldSpawn) {
    let next_voidgrub = VOIDGRUB_SPAWNTIME - matchSeconds
    
    left_timer.img.src = IMG_PATH.voidgrubs
    left_timer.text.textContent = (next_voidgrub < 0 ? 'Alive' : secondsToMin(next_voidgrub))
  }
  
  if (showHeraldSpawn && !showBaronSpawn){
    // HERALD timer
    let next_herald = HERALD_SPAWNTIME - matchSeconds

    left_timer.img.src = IMG_PATH.herald
    left_timer.text.textContent = (next_herald <= 0 ? 'Alive' : secondsToMin(next_herald)) 
  }
  
  if((showBaronSpawn || !showHeraldSpawn) && !showVoidgrubSpawn){
    let next_baron = BARON_SPAWNTIME - matchSeconds

    left_timer.img.src = IMG_PATH.baron
    left_timer.text.textContent = (next_baron <= 0 ? 'Alive' : secondsToMin(next_baron)) 
  }

  if (showAtkhan){
    // ATAKHAN timer
    let next_atakhan_time = ATAKHAN_SPAWNTIME - matchSeconds

    left_bottom_timer.img.src = IMG_PATH.atakhan
    left_bottom_timer.text.textContent = (next_atakhan_time <= 0 ? 'Alive' : secondsToMin(next_atakhan_time) )
  } 
}

function handleAnnouncer(announcerType) {
  switch (announcerType) {
    case 'baron':
      BARON_SPAWNTIME = Number(matchSeconds) + Number(BARON_AFTERKILL)
      break;
    case 'voidgrubs':
      SPAWN_INFO['voidgrubs']['times_killed'] += 1
      VOIDGRUB_SPAWNTIME =  Number(matchSeconds) + Number(VOIDGRUB_AFTERKILL)
      break;
    case 'herald':
      SPAWN_INFO['herald']['was_killed'] = true
      break
    case 'atakhan':
      SPAWN_INFO['atakkan']['was_killed'] = true
      break
    default:
      if (announcerType.includes('elder')) {
        ELDER_SPAWNTIME = Number(matchSeconds) + Number(ELDER_AFTERKILL)
        return 
      }

      SPAWN_INFO['drake']['times_killed'] += 1
      DRAKE_SPAWNTIME = Number(matchSeconds) + Number(DRAKE_AFTERKILL)
      break;
  }
}

  function minToSeconds(minutes, seconds = 0){
  return (minutes * 60) + seconds
}

function secondsToMin(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  // Format as "mm:ss" (e.g., "05:09")
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
