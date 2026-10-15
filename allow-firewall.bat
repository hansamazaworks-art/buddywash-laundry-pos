@echo off
:: Run this ONCE, right-click -> "Run as administrator".
:: Lets other devices on your private Wi-Fi/LAN reach Buddy Wash on port 3000.
netsh advfirewall firewall delete rule name="Buddy Wash (LAN)" >nul 2>&1
netsh advfirewall firewall add rule name="Buddy Wash (LAN)" dir=in action=allow protocol=TCP localport=3000-3010 profile=private,domain
echo.
echo Done. Other devices can now open the address shown in the Buddy Wash app.
pause
