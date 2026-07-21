@echo off
setlocal

echo Este script borra codigo muerto confirmado (paginas viejas sin usar,
echo 2 componentes huerfanos, y 8 imagenes sin referenciar). Correlo desde
echo la carpeta raiz de maintly (donde esta este mismo .bat).
echo.
pause

REM ---- Paginas viejas ya migradas a src\app\[locale]\... (inalcanzables) ----
del /q "src\app\page.tsx"
rmdir /s /q "src\app\login"
rmdir /s /q "src\app\register"
rmdir /s /q "src\app\qr-empty"
rmdir /s /q "src\app\industries"
rmdir /s /q "src\app\asset\[code]"
rmdir /s /q "src\app\legal"
rmdir /s /q "src\app\maintler\[code]"
rmdir /s /q "src\app\maintler"
rmdir /s /q "src\app\terms"
rmdir /s /q "src\app\cookies"
rmdir /s /q "src\app\resources"
rmdir /s /q "src\app\product"
rmdir /s /q "src\app\privacy"
rmdir /s /q "src\app\how-it-works"
rmdir /s /q "src\app\about"
rmdir /s /q "src\app\pricing"
del /q "src\app\api\page.tsx"

REM ---- Componentes huerfanos (solo los usaban las paginas viejas de arriba) ----
del /q "src\components\ReportIssueModal.tsx"
del /q "src\components\ProfessionVerificationForm.tsx"

REM ---- Imagenes sin referenciar en ningun lado del codigo ----
del /q "public\images\fondo.png"
del /q "public\images\Maintly.png"
del /q "public\images\qr-gear.png"
del /q "public\images\qr-gear_crop.png"
del /q "public\images\generator.png"
del /q "public\images\hero-maintly.png"
del /q "public\images\calendar.png"
del /q "public\images\electricidad.png"

echo.
echo Listo! Ahora corre .\push.bat para subir los borrados.
echo.
pause
