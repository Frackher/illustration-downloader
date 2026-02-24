@echo off
REM Lance les tests (installe les dependances si besoin)
REM Utilise CMD pour eviter l'erreur PowerShell "execution de scripts est desactivee"
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe ou pas dans le PATH.
  echo Installez-le via: winget install OpenJS.NodeJS.LTS
  echo Ou telechargez depuis https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installation des dependances...
  call npm.cmd install
  if errorlevel 1 (
    echo Echec de npm install.
    pause
    exit /b 1
  )
)

echo.
echo Lancement des tests...
call npm.cmd test
echo.
pause
