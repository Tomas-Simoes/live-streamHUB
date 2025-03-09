import { IMG_PATH, const_SPAWN_INFO, getWebsocketLatency, minToSeconds, secondsToMin } from "../util/util.js"

export let SPAWN_INFO = const_SPAWN_INFO 

let left_timer, left_bottom_timer, right_timer, matchSeconds
let timerWebsocket, announcerWebsocket

document.addEventListener("DOMContentLoaded", () => {
  connectWebsockets()
  
  let storageSpawnInfo = localStorage.getItem("spawnInfo")
  if (storageSpawnInfo != null ) {
    SPAWN_INFO = JSON.parse(storageSpawnInfo)
    console.log("Updated spawn info from storage.")
  }
  
  left_timer = getFigChilds(document.getElementById("left-fig"), left_timer)
  left_bottom_timer = getFigChilds(document.getElementById("left-down-fig"), left_bottom_timer)  
  right_timer = getFigChilds(document.getElementById("right-fig"), right_timer)
  
  left_timer.changeVisibility('hidden')
  left_bottom_timer.changeVisibility('hidden')
  right_timer.changeVisibility('hidden')

})

window.addEventListener("beforeunload", function() {
  localStorage.setItem("spawnInfo", JSON.stringify(SPAWN_INFO))
})

function getFigChilds(fig_el, bundled_el) {
  bundled_el = {
    'text': fig_el.querySelector("figcaption"),
    'img': fig_el.querySelector("img"),
    'changeVisibility': (visibility) => changeElementVisibility(bundled_el, visibility)
  }

  return bundled_el
}

function changeElementVisibility(element, visibility) {
  element.text.style.visibility = visibility
  element.img.style.visibility = visibility
}

function updateTimers(newMatchSeconds){
  matchSeconds = newMatchSeconds
  
  let showDrakeSpawn = SPAWN_INFO.drake.times_killed < SPAWN_INFO.drake.maxrespawn
  let showVoidgrubSpawn = SPAWN_INFO.voidgrubs.times_killed < 2 && matchSeconds < SPAWN_INFO.herald.spawntime - SPAWN_INFO.voidgrubs.afterkill
  let showHeraldSpawn = !showVoidgrubSpawn || (!SPAWN_INFO.herald.was_killed && matchSeconds > SPAWN_INFO.herald.spawntime - minToSeconds(4))
  let showBaronSpawn = !showHeraldSpawn || (matchSeconds > SPAWN_INFO.baron.spawntime - minToSeconds(4) && matchSeconds > SPAWN_INFO.herald.spawntime + minToSeconds(1))
  let showAtkhan = matchSeconds >= SPAWN_INFO.atakhan.spawntime - minToSeconds(10) && !SPAWN_INFO.atakhan.was_killed
  
  left_timer.changeVisibility(showVoidgrubSpawn || showHeraldSpawn || showBaronSpawn ? 'visible' : 'hidden')
  left_bottom_timer.changeVisibility(showAtkhan ? 'visible' : 'hidden')
  right_timer.changeVisibility(showDrakeSpawn ? 'visible' : 'hidden')
  
  //TODO figure out how will I know the specific drake (ocean, mountain etc...)
  if (showDrakeSpawn){
    let next_drake = SPAWN_INFO.drake.spawntime - matchSeconds
    
    right_timer.img.src = IMG_PATH.cloud
    right_timer.text.textContent = (next_drake < 0 ? 'Alive' : secondsToMin(next_drake)) 
  } else {
    let next_elder = SPAWN_INFO.elder.spawntime - matchSeconds
    
    right_timer.img.src = IMG_PATH.elder
    right_timer.text.textContent = (next_elder < 0 ? 'Alive' : secondsToMin(next_elder)) 
  }

  if(showVoidgrubSpawn && !showHeraldSpawn) {
    let next_voidgrub = SPAWN_INFO.voidgrubs.spawntime - matchSeconds
    
    left_timer.img.src = IMG_PATH.voidgrubs
    left_timer.text.textContent = (next_voidgrub < 0 ? 'Alive' : secondsToMin(next_voidgrub))
  }
  
  if (showHeraldSpawn && !showBaronSpawn){
    // HERALD timer
    let next_herald = SPAWN_INFO.herald.spawntime - matchSeconds

    left_timer.img.src = IMG_PATH.herald
    left_timer.text.textContent = (next_herald <= 0 ? 'Alive' : secondsToMin(next_herald)) 
  }
  
  if((showBaronSpawn || !showHeraldSpawn) && !showVoidgrubSpawn){
    let next_baron = SPAWN_INFO.baron.spawntime - matchSeconds

    left_timer.img.src = IMG_PATH.baron
    left_timer.text.textContent = (next_baron <= 0 ? 'Alive' : secondsToMin(next_baron)) 
  }

  if (showAtkhan){
    // ATAKHAN timer
    let next_atakhan_time = SPAWN_INFO.atakhan.spawntime - matchSeconds

    left_bottom_timer.img.src = IMG_PATH.atakhan
    left_bottom_timer.text.textContent = (next_atakhan_time <= 0 ? 'Alive' : secondsToMin(next_atakhan_time) )
  } 
}

function handleAnnouncer(announcerType) {
  console.log(announcerType)
  switch (announcerType.toLowerCase()) {
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
      } else if (announcerType.includes('drake')) {
        SPAWN_INFO['drake']['times_killed'] += 1
        DRAKE_SPAWNTIME = Number(matchSeconds) + Number(DRAKE_AFTERKILL)
      }
      break;
    }
}

function connectWebsockets() {
  timerWebsocket = new WebSocket("ws://localhost:8080/webclient/timer");
  announcerWebsocket = new WebSocket("ws://localhost:8080/webclient/announcer")

  timerWebsocket.onopen = () => {
    console.log("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"");
    timerWebsocket.send("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"")
  };
  
  timerWebsocket.onmessage = (event) => {
    let receivedData = JSON.parse(event.data);
    
    if(receivedData.firstTimeToken) {
      console.log("First time connection, erasing data.")
      
      localStorage.clear()
      SPAWN_INFO = const_SPAWN_INFO
    }
    
    if(receivedData.latency_data) {
      // Send the latency information back through the WebSocket
      announcerWebsocket.send(`Timer Webclient ${getWebsocketLatency(receivedData.latency_data)}`);
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
       announcerWebsocket.send(`Timer Webclient (announcer) ${getWebsocketLatency(receivedData.latency_data)}`);
    }
    
    if(receivedData.data) {
      receivedData.data.events.forEach(chat_event => {
        handleAnnouncer(chat_event.data)
      });
    }
  };
}