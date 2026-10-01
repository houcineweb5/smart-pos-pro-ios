@echo off
title Smart POS Pro - iOS App Builder (GitHub Actions)
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;C:\Program Files\GitHub CLI;%PATH%"

echo ================================================================
echo   Smart POS Pro - Preparation et Envoi vers GitHub (iOS .ipa)
echo ================================================================
echo.

echo [1/3] Verification de la connexion GitHub...
"C:\Program Files\GitHub CLI\gh.exe" auth status >nul 2>&1
if errorlevel 1 (
    echo.
    echo Veuillez vous connecter a votre compte GitHub dans le navigateur...
    "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web
)

echo.
echo [2/3] Creation du depot 'smart-pos-pro-ios' et envoi du code...
"C:\Program Files\GitHub CLI\gh.exe" repo create smart-pos-pro-ios --private --source=. --remote=origin --push
if errorlevel 1 (
    echo Le depot existe deja, mise a jour du code...
    "%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" push -u origin main
)

echo.
echo [3/3] Ouverture de la page GitHub Actions pour telecharger le fichier .ipa...
"C:\Program Files\GitHub CLI\gh.exe" repo view --web
echo.
echo ================================================================
echo   TERMINE ! Cliquez sur l'onglet "Actions" dans la page ouverte,
echo   attendez 2 minutes, puis telechargez "SmartPOS-Pro-iOS-IPA".
echo ================================================================
pause
