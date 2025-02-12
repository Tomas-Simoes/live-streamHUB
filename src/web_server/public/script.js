
document.addEventListener("DOMContentLoaded", () => {
  var messageCount = 0
  const websocket = new WebSocket("ws://localhost:8080/webserver");
  
  websocket.onopen = () => {
    console.log("WebSocket connection established.");
    websocket.send("Web Server connected at \"ws://localhost:8080/webserver\"")
  };
  
  websocket.onmessage = (event) => {
    messageCount++
    console.log("Message " + messageCount + " from server:", event.data);
    
    document.getElementById("data").textContent = "Data received ("+ messageCount +"): " + event.data
    
    websocket.send("Message received from client.")
  };

  websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
  
  websocket.onclose = () => {
    console.log("WebSocket connection closed.");
  };
  
  const team1 = document.getElementById("team1");
  const team2 = document.getElementById("team2");
  
  for (let i = 1; i <= 5; i++) {
      let playerHTML = `
          <div class="player" id="player-${i}">
              <img class="champion" id="champ-${i}" src="images/champion-placeholder.png" alt="Champion">
  
              <div class="items">
                  <div class="item">
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
                  <div class="item">
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
                  <div class="item">
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
                  <div class="item">                    
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
                  <div class="item">                    
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
                  <div class="item">                    
                    <img class="item-img" src="images/item-placeholder.png">
                  </div>
              </div>
              <div class="stats"> <span id="score1-${i}">0/0/0</span> <span id="cs1-${i}">0</span> </div>
          </div>
      `;
      team1.innerHTML += playerHTML;
      team2.innerHTML += playerHTML.replace(/score1/g, "score2").replace(/cs1/g, "cs2");
  }
});