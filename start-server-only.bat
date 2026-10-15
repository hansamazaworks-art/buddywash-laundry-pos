@echo off
:: Runs just the server (no Electron window) — handy on a spare PC. Needs Node.js.
cd /d "%~dp0"
node server.js
pause
