export const IMG_PATH = {
  voidgrubs: "images/LLD_voidgrub-timer.png",
  herald: "images/LLD_herald-timer.png",
  baron: "images/LLD_baron-timer.png",

  ocean: "images/LLD_ocean-timer.png",
  mountain: "images/LLD_mountain-timer.png",
  cloud: "images/LLD_cloud-timer.png",
  infernal: "images/LLD_infernal-timer.png",
  elder: "images/champion-placeholder.png",

  atakhan: "images/LLD_atakhan-timer.png"
};

export const const_SPAWN_INFO = {
  "drake": {
    "spawntime": minToSeconds(5),
    "afterkill": minToSeconds(5),
    "maxrespawn": 4,

    "was_killed": false,
    "times_killed": 0,
  },
  "herald": {
    "spawntime": minToSeconds(16),
    "afterkill": null,
    "maxrespawn": null,

    "was_killed": false,
    "times_killed": 0,
  },
  "voidgrubs": {
    "spawntime": minToSeconds(6),
    "afterkill": minToSeconds(4),
    "maxrespawn": null,

    "was_killed": false,
    "times_killed": 0,
  },
  "baron": {
    "spawntime": minToSeconds(25),
    "afterkill": minToSeconds(6),
    "maxrespawn": null,

    "was_killed": false,
    "times_killed": 0,
  },
  "atakhan": {
    "spawntime": minToSeconds(20),
    "afterkill": null,
    "maxrespawn": null,

    "was_killed": false,
    "times_killed": 0,
  },
  "elder": {
    "spawntime": minToSeconds(6),
    "afterkill": minToSeconds(6),
    "maxrespawn": null,

    "was_killed": false,
    "times_killed": 0,
  }
};

export function minToSeconds(minutes, seconds = 0){
  return (minutes * 60) + seconds
}

export function secondsToMin(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  // Format as "mm:ss" (e.g., "05:09")
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function getWebsocketLatency(latency_data) {
  latency_data.webclient_timestamp = Date.now() / 1000

  let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
  let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
  let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
  let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

  return `received in OW-WS${overwolfToWebSocket} / WS-DP${webSocketToDataProcessor} / DP-WC${dataProcessorToWebClient} (total: ${totalLatency})`
}
