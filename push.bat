@echo off
rem Sube todos los cambios a GitHub (Vercel publica solo). Uso:
rem   .\push.bat "que cambio"      o   .\push.bat   (y te pregunta el mensaje)
setlocal
set "msg=%~1"
if "%msg%"=="" set /p "msg=Mensaje del commit: "
if "%msg%"=="" set "msg=Update"
rem 22/10/2026: primero las migraciones nuevas de supabase/migrations/ a la
rem base (Supabase CLI, vinculada con "npx supabase link"). Si no hay nada
rem nuevo dice "Remote database is up to date". Si pregunta, respondé y.
rem Si falla, NO se sube el codigo (asi nunca queda el sitio sin su tabla).
call npx supabase db push
if errorlevel 1 (
  echo.
  echo ERROR aplicando migraciones. No se subio nada. Revisa el mensaje de arriba.
  exit /b 1
)
git add -A
git commit -m "%msg%"
git push
echo.
echo Listo, cambios subidos! Mira Vercel - Deployments hasta que diga Ready.
endlocal
