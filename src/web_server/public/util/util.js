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

export function getWebsocketLatency(latency_data) {
  latency_data.webclient_timestamp = Date.now() / 1000

  let overwolfToWebSocket = latency_data.websocket_timestamp - latency_data.overwolf_timestamp;
  let webSocketToDataProcessor = latency_data.dataprocessor_timestamp - latency_data.websocket_timestamp;
  let dataProcessorToWebClient = latency_data.webclient_timestamp - latency_data.dataprocessor_timestamp;
  let totalLatency = latency_data.webclient_timestamp - latency_data.overwolf_timestamp;

  return `received in OW-WS${overwolfToWebSocket} / WS-DP${webSocketToDataProcessor} / DP-WC${dataProcessorToWebClient} (total: ${totalLatency})`
}

export default {IMG_PATH, getWebsocketLatency}