@echo off
title Smart POS Pro - Android App Builder (GitHub Actions)
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;C:\Program Files\GitHub CLI;%PATH%"

echo ================================================================
echo   Smart POS Pro - Preparation et Envoi vers GitHub (Android .apk)
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
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" commit -m "Update Smart POS Pro Android with latest features" >nul 2>&1
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" push -u origin main

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions...
echo (Veuillez patienter pendant la generation du fichier .apk...)
"C:\Program Files\GitHub CLI\gh.exe" run watch

echo.
echo [4/4] Telechargement automatique du nouveau fichier .apk...
if exist "%TEMP%\smartpos_apk" rmdir /s /q "%TEMP%\smartpos_apk"
mkdir "%TEMP%\smartpos_apk"
"C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-Android-APK -D "%TEMP%\smartpos_apk"

if exist "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" (
    copy /y "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" "%USERPROFILE%\Desktop\SmartPOS-Pro-Android.apk" >nul
    if not exist "%~dp0Android-Release" mkdir "%~dp0Android-Release"
    copy /y "%TEMP%\smartpos_apk\SmartPOS-Pro-Android.apk" "%~dp0Android-Release\SmartPOS-Pro-Android.apk" >nul
    rmdir /s /q "%TEMP%\smartpos_apk"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .apk a ete copie avec succes:
    echo   1. Sur votre Bureau (Desktop\SmartPOS-Pro-Android.apk)
    echo   2. Dans le dossier Android-Release
    echo   Vous pouvez maintenant l'installer directement sur votre telephone Android !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour le telechargement manuel...
    "C:\Program Files\GitHub CLI\gh.exe" repo view --web
)

pause
