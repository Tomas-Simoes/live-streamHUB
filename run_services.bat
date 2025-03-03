@echo off

set CURRENT_DIR=%cd%

if "%1" == "-d" (
    echo Running in development mode...
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "echo Starting app... && nodemon .\\app.py"^
        ;split-pane -V -d "%CURRENT_DIR%" cmd /k "echo Starting HTTP server... && nodemon .\\web_server\\server.js" ^ 
        ;split-pane -H -d "%CURRENT_DIR%" cmd /k "echo Starting Websocket server... && python -m websockets ws://localhost:8080/"
) else (
    echo Running in production mode...
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "echo Starting app... && python .\\app.py"^
        ;split-pane -V -d "%CURRENT_DIR%" cmd /k "echo Starting HTTP server... && node .\\web_server\\server.js" ^ 
        ;split-pane -H -d "%CURRENT_DIR%" cmd /k "echo Starting Websocket server... && python -m websockets ws://localhost:8080/"
)

.\build-overwolf.bat
