@echo off
title Smart POS Pro - macOS App Builder (GitHub Actions)
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
echo   Smart POS Pro - Preparation et Envoi vers GitHub (macOS .dmg)
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
    git commit -m "Update Smart POS Pro macOS with latest features (%date% %time%)"
    git push origin main
) else (
    echo Aucun nouveau commit requis, declenchement direct du workflow macOS...
    "C:\Program Files\GitHub CLI\gh.exe" workflow run build-mac.yml --ref main
)

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions (macOS)...
echo (Veuillez patienter pendant la generation du fichier .dmg, environ 1 a 2 minutes...)
timeout /t 6 /nobreak >nul

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
    echo Recherche et suivi standard du build...
    "C:\Program Files\GitHub CLI\gh.exe" run watch
    if exist "%TEMP%\smartpos_mac" rmdir /s /q "%TEMP%\smartpos_mac"
    mkdir "%TEMP%\smartpos_mac"
    "C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-macOS-DMG -D "%TEMP%\smartpos_mac"
)

if exist "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" (
    copy /y "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" "%USERPROFILE%\Desktop\SmartPOS-Pro-macOS.dmg" >nul
    if not exist "%REPO_DIR%\Mac-Release" mkdir "%REPO_DIR%\Mac-Release"
    copy /y "%TEMP%\smartpos_mac\SmartPOS-Pro-macOS.dmg" "%REPO_DIR%\Mac-Release\SmartPOS-Pro-macOS.dmg" >nul
    rmdir /s /q "%TEMP%\smartpos_mac"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .dmg a ete genere et copie:
    echo   1. Sur votre Bureau: %USERPROFILE%\Desktop\SmartPOS-Pro-macOS.dmg
    echo   2. Dans le dossier: %REPO_DIR%\Mac-Release\SmartPOS-Pro-macOS.dmg
    echo   Vous pouvez maintenant l'installer directement sur votre Mac (MacBook / iMac) !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour visualiser les Actions...
    if defined MAC_RUN_ID (
        "C:\Program Files\GitHub CLI\gh.exe" run view %MAC_RUN_ID% --web
    ) else (
        "C:\Program Files\GitHub CLI\gh.exe" repo view --web
    )
)

pause
