@echo off
title Smart POS Pro - iOS App Builder (GitHub Actions)
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;C:\Program Files\GitHub CLI;%PATH%"

echo ================================================================
echo   Smart POS Pro - Preparation et Envoi vers GitHub (iOS .ipa)
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
"%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" commit -m "Update Smart POS Pro iOS with latest features" >nul 2>&1
"C:\Program Files\GitHub CLI\gh.exe" repo create smart-pos-pro-ios --private --source=. --remote=origin --push >nul 2>&1
if errorlevel 1 (
    echo Mise a jour du code sur GitHub...
    "%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" push -u origin main
)

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions...
echo (Veuillez patienter pendant la generation du fichier .ipa...)
"C:\Program Files\GitHub CLI\gh.exe" run watch

echo.
echo [4/4] Telechargement automatique du nouveau fichier .ipa...
if exist "%TEMP%\smartpos_ipa" rmdir /s /q "%TEMP%\smartpos_ipa"
mkdir "%TEMP%\smartpos_ipa"
"C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-iOS-IPA -D "%TEMP%\smartpos_ipa"

if exist "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" (
    copy /y "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" "%USERPROFILE%\Desktop\SmartPOS-Pro-iOS.ipa" >nul
    if not exist "%~dp0iOS-Release" mkdir "%~dp0iOS-Release"
    copy /y "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" "%~dp0iOS-Release\SmartPOS-Pro-iOS.ipa" >nul
    rmdir /s /q "%TEMP%\smartpos_ipa"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .ipa a ete copie avec succes:
    echo   1. Sur votre Bureau (Desktop\SmartPOS-Pro-iOS.ipa)
    echo   2. Dans le dossier iOS-Release
    echo   Vous pouvez maintenant l'installer via Sideloadly !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour le telechargement manuel...
    "C:\Program Files\GitHub CLI\gh.exe" repo view --web
)

pause
