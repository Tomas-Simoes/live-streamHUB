@echo off

set CURRENT_DIR=%cd%
wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "echo Starting HTTP server... && python -m http.server --directory .\\src\\public"^
    ;split-pane -V -d "%CURRENT_DIR%" cmd /k "echo Starting app... && python .\\src\\app.py" ^
    ;split-pane -H -d "%CURRENT_DIR%" cmd /k "echo Starting Websocket server... && python -m websockets ws://localhost:8001/"
