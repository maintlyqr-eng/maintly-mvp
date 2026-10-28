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
rem 28/10/2026: solo se conecta a la base si este commit trae una migracion
rem nueva o modificada. Si es solo codigo, va directo a git (no depende de
rem la red llegue a Supabase).
set "hasmig="
for /f "delims=" %%L in ('git status --porcelain supabase/migrations 2^>nul') do set "hasmig=1"
if defined hasmig (
  echo Hay migraciones nuevas: aplicando en Supabase...
  call npx supabase db push
  if errorlevel 1 (
    echo.
    echo ERROR aplicando migraciones. No se subio nada. Revisa el mensaje de arriba.
    echo Si dice "Connection timed out", es la red: proba desde otra wifi o sin hotspot.
    exit /b 1
  )
) else (
  echo Sin migraciones nuevas: no hace falta tocar la base.
)
git add -A
git commit -m "%msg%"
git push
echo.
echo Listo, cambios subidos! Mira Vercel - Deployments hasta que diga Ready.
endlocal
