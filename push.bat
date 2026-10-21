@echo off
rem Sube todos los cambios a GitHub (Vercel publica solo). Uso:
rem   .\push.bat "que cambio"      o   .\push.bat   (y te pregunta el mensaje)
setlocal
set "msg=%~1"
if "%msg%"=="" set /p "msg=Mensaje del commit: "
if "%msg%"=="" set "msg=Update"
git add -A
git commit -m "%msg%"
git push
echo.
echo Listo, cambios subidos! Mira Vercel - Deployments hasta que diga Ready.
endlocal
