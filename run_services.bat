@echo off
set CURRENT_DIR=%cd%

echo Starting live-streamHUB services...
echo Backend: http://localhost:3000
echo Web:     http://localhost:5173

if "%1" == "-ow" (
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "npm run start:dev --prefix .\src\backend" ^
        ; split-pane -V -d "%CURRENT_DIR%" cmd /k "npm run dev --prefix .\src\web" ^
        ; split-pane -H -d "%CURRENT_DIR%" cmd /k "npm run start:overwolf"
) else (
    wt.exe -p "Command Prompt" -d "%CURRENT_DIR%" cmd /k "npm run start:dev --prefix .\src\backend" ^
        ; split-pane -V -d "%CURRENT_DIR%" cmd /k "npm run dev --prefix .\src\web"
)
