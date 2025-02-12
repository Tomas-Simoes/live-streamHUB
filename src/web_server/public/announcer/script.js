let drakeAnnouncer, baronAnnouncer, elderAnnouncer

document.addEventListener("DOMContentLoaded", () => {
  const websocket = new WebSocket("ws://localhost:8080/webclient/announcer");

  drakeAnnouncer = document.getElementById("drake-announcer");
  baronAnnouncer = document.getElementById("baron-announcer");
  elderAnnouncer = document.getElementById("elder-announcer");

  websocket.onopen = () => {
    console.log("Announcer Webclient connected at \"ws://localhost:8080/webclient/announcer\"");
    websocket.send("Announcer Webclient connected connected at \"ws://localhost:8080/webclient/announcer\"")
  };

  websocket.onmessage = (event) => {
    websocket.send("Message received from Announcer Webclient: " + event.data) 
    updateAnnouncer(JSON.parse(event.data).data)   
  };
})

function updateAnnouncer(announcerType){
  switch (announcerType.toLowerCase()) {
    case "baron":
      showAndHide(baronAnnouncer, announcerType)
      break
    case "elder":
      showAndHide(elderAnnouncer, announcerType)
      break
    default:
      showAndHide(drakeAnnouncer, announcerType)
      break
  }
}

function showAndHide(announcer, type){
  
  if (!announcer) {
    console.error(`Announcer element for ${type} not initialized!`);
    return;
  }
  
  announcer.textContent = type
  announcer.style.visibility = 'visible'
  
  setTimeout(() => {
      announcer.style.visibility = 'hidden'
    }, 10000)
}