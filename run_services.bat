@echo off

set CURRENT_DIR=%cd%

if "%1" == "-d" (
    echo Running in development mode...
    call "%CURRENT_DIR%\env\Scripts\activate.bat"
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "echo Starting app... && nodemon .\\src\\app.py"^
        ;split-pane -V -d "%CURRENT_DIR%" cmd /k "echo Starting HTTP server... && nodemon .\\src\\web_server\\server.js" ^ 
        ;split-pane -H -d "%CURRENT_DIR%" cmd /k "echo Starting Websocket server... && python -m websockets ws://localhost:8080/"
) else (
    echo Running in production mode...
    call "%CURRENT_DIR%\env\Scripts\activate.bat"
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "echo Starting app... && python .\\src\\app.py"^
        ;split-pane -V -d "%CURRENT_DIR%" cmd /k "echo Starting HTTP server... && node .\\src\\web_server\\server.js" ^ 
        ;split-pane -H -d "%CURRENT_DIR%" cmd /k "echo Starting Websocket server... && python -m websockets ws://localhost:8080/"
)

.\build-overwolf.bat
