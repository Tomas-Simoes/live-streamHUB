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

const SPAWN_INFO = {
  "drake": {
    "was_killed": false,
    "times_killed": 0,
  },
  "herald": {
    "was_killed": false,
  },
  "voidgrubs": {
    "times_killed": 0,
  },
  "atakkan": {
    "was_killed": false,
  },
  "elder": {
    "was_killed": false,
  }
};

let left_timer, left_timer_bottom, right_timer, matchSeconds
let isTimerVisible = false

document.addEventListener("DOMContentLoaded", () => {
  const timerWebsocket = new WebSocket("ws://localhost:8080/webclient/timer");
  const announcerWebsocket = new WebSocket("ws://localhost:8080/webclient/announcer")

  left_timer = document.getElementById("top-left-timer")
  left_timer_bottom = document.getElementById("top-left-down-timer")


  right_timer = document.getElementById("top-right-timer")
  
  timerWebsocket.onopen = () => {
    console.log("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"");
    timerWebsocket.send("Timer Webclient connected at \"ws://localhost:8080/webclient/timer\"")
  };

  timerWebsocket.onmessage = (event) => {
    timerWebsocket.send("Message received from Timer Webclient: " + event.data)
    
    updateTimers(JSON.parse(event.data).data)
  };

  announcerWebsocket.onopen = () => {
    console.log("Timer Webclient connected at \"ws://localhost:8080/webclient/announcer\"");
    announcerWebsocket.send("Timer Webclient connected at \"ws://localhost:8080/webclient/announcer\"")
  };

  announcerWebsocket.onmessage = (event) => {
    announcerWebsocket.send("Message received from Timer Webclient: " + event.data)
    
    handleAnnouncer(JSON.parse(event.data).data)
  };
})

function updateTimers(newMatchSeconds){
  matchSeconds = newMatchSeconds
  
  let showDrakeSpawn = SPAWN_INFO['drake']['times_killed'] < DRAKE_MAXRESPAWN
  let showVoidgrubSpawn = SPAWN_INFO['voidgrubs']['times_killed'] < 2 && matchSeconds < HERALD_SPAWNTIME - VOIDGRUB_AFTERKILL
  let showHeraldSpawn = !showVoidgrubSpawn || (!SPAWN_INFO['herald']['was_killed'] && matchSeconds > HERALD_SPAWNTIME - minToSeconds(4))
  let showBaronSpawn = !showHeraldSpawn || (matchSeconds > BARON_SPAWNTIME - minToSeconds(4) && matchSeconds > HERALD_SPAWNTIME + minToSeconds(1))
  let showAtkhan = matchSeconds >= ATAKHAN_SPAWNTIME - minToSeconds(10) && !SPAWN_INFO['atakkan']['was_killed']
  
  left_timer.style.visibility = showVoidgrubSpawn || showHeraldSpawn || showBaronSpawn ? 'visible' : 'hidden'
  right_timer.style.visibility = showDrakeSpawn ? 'visible' : 'hidden'
  left_timer_bottom.style.visibility = showAtkhan ? 'visible' : 'hidden'



  if (showDrakeSpawn){
    // DRAKE timer
    let next_drake = DRAKE_SPAWNTIME - matchSeconds
    right_timer.textContent = (next_drake < 0 ? 'Alive' : secondsToMin(next_drake)) 
  } else {
    let next_elder = ELDER_SPAWNTIME - matchSeconds
    right_timer.textContent = (next_elder < 0 ? 'Alive' : secondsToMin(next_elder)) 
  }


  if(showVoidgrubSpawn && !showHeraldSpawn) {
    let next_voidgrub = VOIDGRUB_SPAWNTIME - matchSeconds
    left_timer.textContent = (next_voidgrub < 0 ? 'Alive' : secondsToMin(next_voidgrub))
  }
  
  if (showHeraldSpawn && !showBaronSpawn){
    // HERALD timer
    let next_herald = HERALD_SPAWNTIME - matchSeconds
    left_timer.textContent = (next_herald <= 0 ? 'Alive' : secondsToMin(next_herald)) 
  }
  
  if((showBaronSpawn || !showHeraldSpawn) && !showVoidgrubSpawn){
    let next_baron = BARON_SPAWNTIME - matchSeconds
    left_timer.textContent = (next_baron <= 0 ? 'Alive' : secondsToMin(next_baron)) 
  }

  if (showAtkhan){
    // ATAKHAN timer
    let next_atakhan_time = ATAKHAN_SPAWNTIME - matchSeconds
    left_timer_bottom.textContent = (next_atakhan_time <= 0 ? 'Alive' : secondsToMin(next_atakhan_time) )
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
    case 'rift herald':
      SPAWN_INFO['herald']['was_killed'] = true
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
