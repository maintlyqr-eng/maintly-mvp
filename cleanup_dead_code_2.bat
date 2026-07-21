@echo off
setlocal

echo Segunda tanda de limpieza: borra el endpoint de admin/messages
echo (huerfano, duplicaba lo que ya haces desde "escribirle a X" en
echo Cuentas) y la pagina mockup /asset (ya no hace falta, el asset
echo de ejemplo real ya existe). Correlo desde la raiz de maintly.
echo.
pause

rmdir /s /q "src\app\api\admin\messages"
rmdir /s /q "src\app\asset"

echo.
echo Listo! Ahora corre .\push.bat para subir los borrados.
echo.
pause
