@echo off
title Smart POS Pro - macOS App Builder (GitHub Actions)
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;C:\Program Files\GitHub CLI;%PATH%"

echo ================================================================
echo   Smart POS Pro - Preparation et Envoi vers GitHub (macOS .dmg)
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
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" add -A
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" commit -m "Update Smart POS Pro macOS with latest features" >nul 2>&1
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" push -u origin main

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions (macOS)...
echo (Veuillez patienter pendant la generation du fichier .dmg, environ 2 a 3 minutes...)
timeout /t 5 /nobreak >nul
for /f "tokens=*" %%i in ('"C:\Program Files\GitHub CLI\gh.exe" run list --workflow=build-mac.yml --limit 1 --json databaseId --jq ".[0].databaseId"') do set "MAC_RUN_ID=%%i"

if defined MAC_RUN_ID (
    echo Build macOS detecte (ID: %MAC_RUN_ID%), suivi en direct...
    "C:\Program Files\GitHub CLI\gh.exe" run watch %MAC_RUN_ID%
    echo.
    echo [4/4] Telechargement automatique du nouveau fichier .dmg...
    if exist "%TEMP%\smartpos_mac" rmdir /s /q "%TEMP%\smartpos_mac"
    mkdir "%TEMP%\smartpos_mac"
    "C:\Program Files\GitHub CLI\gh.exe" run download %MAC_RUN_ID% -n SmartPOS-Pro-macOS-DMG -D "%TEMP%\smartpos_mac"
) else (
    echo Suivi standard...
    "C:\Program Files\GitHub CLI\gh.exe" run watch
    if exist "%TEMP%\smartpos_mac" rmdir /s /q "%TEMP%\smartpos_mac"
    mkdir "%TEMP%\smartpos_mac"
    "C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-macOS-DMG -D "%TEMP%\smartpos_mac"
)

if exist "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" (
    copy /y "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" "%USERPROFILE%\Desktop\SmartPOS-Pro-macOS.dmg" >nul
    if not exist "%~dp0Mac-Release" mkdir "%~dp0Mac-Release"
    copy /y "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" "%~dp0Mac-Release\SmartPOS-Pro-macOS.dmg" >nul
    rmdir /s /q "%TEMP%\smartpos_mac"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .dmg a ete copie avec succes:
    echo   1. Sur votre Bureau (Desktop\SmartPOS-Pro-macOS.dmg)
    echo   2. Dans le dossier Mac-Release
    echo   Vous pouvez maintenant l'installer directement sur votre Mac (MacBook / iMac) !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour le telechargement...
    "C:\Program Files\GitHub CLI\gh.exe" repo view --web
)

pause
