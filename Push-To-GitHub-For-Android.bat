@echo off
title Smart POS Pro - Android App Builder (GitHub Actions)
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;C:\Program Files\GitHub CLI;%PATH%"

:: Automatic project directory detection (works from Desktop, Downloads, or repository folder)
set "REPO_DIR=%~dp0"
if exist "%~dp0.git" (
    set "REPO_DIR=%~dp0"
) else if exist "%USERPROFILE%\Downloads\sales-and-invoicing-system\.git" (
    set "REPO_DIR=%USERPROFILE%\Downloads\sales-and-invoicing-system"
) else if exist "%USERPROFILE%\Desktop\sales-and-invoicing-system\.git" (
    set "REPO_DIR=%USERPROFILE%\Desktop\sales-and-invoicing-system"
) else if exist "%~dp0sales-and-invoicing-system\.git" (
    set "REPO_DIR=%~dp0sales-and-invoicing-system"
)

cd /d "%REPO_DIR%"

echo ================================================================
echo   Smart POS Pro - Preparation et Envoi vers GitHub (Android .apk)
echo   Dossier source: %CD%
echo ================================================================
echo.

echo [1/4] Verification de la connexion GitHub...
"C:\Program Files\GitHub CLI\gh.exe" auth status >nul 2>&1
if errorlevel 1 (
    echo.
    echo Veuillez vous connecter a votre compte GitHub dans le navigateur...
    "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web
)

echo.
echo [2/4] Enregistrement des dernieres modifications et envoi vers GitHub...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Update Smart POS Pro Android with latest features (%date% %time%)"
    git push origin main
) else (
    echo Aucun nouveau commit requis, declenchement direct du workflow Android...
    "C:\Program Files\GitHub CLI\gh.exe" workflow run build-android.yml --ref main
)

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions...
echo (Veuillez patienter pendant la generation du fichier .apk, environ 1 a 2 minutes...)
timeout /t 6 /nobreak >nul

for /f "tokens=*" %%i in ('"C:\Program Files\GitHub CLI\gh.exe" run list --workflow=build-android.yml --limit 1 --json databaseId --jq ".[0].databaseId"') do set "ANDROID_RUN_ID=%%i"

if defined ANDROID_RUN_ID (
    echo Build Android detecte (ID: %ANDROID_RUN_ID%), suivi en direct...
    "C:\Program Files\GitHub CLI\gh.exe" run watch %ANDROID_RUN_ID%
    echo.
    echo [4/4] Telechargement automatique du nouveau fichier .apk...
    if exist "%TEMP%\smartpos_apk" rmdir /s /q "%TEMP%\smartpos_apk"
    mkdir "%TEMP%\smartpos_apk"
    "C:\Program Files\GitHub CLI\gh.exe" run download %ANDROID_RUN_ID% -n SmartPOS-Pro-Android-APK -D "%TEMP%\smartpos_apk"
) else (
    "C:\Program Files\GitHub CLI\gh.exe" run watch
    if exist "%TEMP%\smartpos_apk" rmdir /s /q "%TEMP%\smartpos_apk"
    mkdir "%TEMP%\smartpos_apk"
    "C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-Android-APK -D "%TEMP%\smartpos_apk"
)

if exist "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" (
    copy /y "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" "%USERPROFILE%\Desktop\SmartPOS-Pro-Android.apk" >nul
    if not exist "%REPO_DIR%\Android-Release" mkdir "%REPO_DIR%\Android-Release"
    copy /y "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" "%REPO_DIR%\Android-Release\SmartPOS-Pro-Android.apk" >nul
    rmdir /s /q "%TEMP%\smartpos_apk"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .apk a ete copie avec succes:
    echo   1. Sur votre Bureau: %USERPROFILE%\Desktop\SmartPOS-Pro-Android.apk
    echo   2. Dans le dossier: %REPO_DIR%\Android-Release
    echo   Vous pouvez maintenant l'installer directement sur votre telephone Android !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour le telechargement manuel...
    "C:\Program Files\GitHub CLI\gh.exe" repo view --web
)

pause
