@echo off
title Smart POS Pro - iOS App Builder (GitHub Actions)
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
echo   Smart POS Pro - Preparation et Envoi vers GitHub (iOS .ipa)
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
    git commit -m "Update Smart POS Pro iOS with latest features (%date% %time%)"
    git push origin main
) else (
    echo Aucun nouveau commit requis, declenchement direct du workflow iOS...
    "C:\Program Files\GitHub CLI\gh.exe" workflow run build-ios.yml --ref main
)

echo.
echo [3/4] Suivi de la compilation sur GitHub Actions (iOS)...
echo (Veuillez patienter pendant la generation du fichier .ipa, environ 6 a 8 minutes...)
timeout /t 6 /nobreak >nul

for /f "tokens=*" %%i in ('"C:\Program Files\GitHub CLI\gh.exe" run list --workflow=build-ios.yml --limit 1 --json databaseId --jq ".[0].databaseId"') do set "IOS_RUN_ID=%%i"

if defined IOS_RUN_ID (
    echo Build iOS detecte (ID: %IOS_RUN_ID%), suivi en direct...
    "C:\Program Files\GitHub CLI\gh.exe" run watch %IOS_RUN_ID%
    echo.
    echo [4/4] Telechargement automatique du nouveau fichier .ipa...
    if exist "%TEMP%\smartpos_ipa" rmdir /s /q "%TEMP%\smartpos_ipa"
    mkdir "%TEMP%\smartpos_ipa"
    "C:\Program Files\GitHub CLI\gh.exe" run download %IOS_RUN_ID% -n SmartPOS-Pro-iOS-IPA -D "%TEMP%\smartpos_ipa"
) else (
    "C:\Program Files\GitHub CLI\gh.exe" run watch
    if exist "%TEMP%\smartpos_ipa" rmdir /s /q "%TEMP%\smartpos_ipa"
    mkdir "%TEMP%\smartpos_ipa"
    "C:\Program Files\GitHub CLI\gh.exe" run download -n SmartPOS-Pro-iOS-IPA -D "%TEMP%\smartpos_ipa"
)

if exist "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" (
    copy /y "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" "%USERPROFILE%\Desktop\SmartPOS-Pro-iOS.ipa" >nul
    if not exist "%REPO_DIR%\iOS-Release" mkdir "%REPO_DIR%\iOS-Release"
    copy /y "%TEMP%\smartpos_ipa\SmartPOS-Pro-iOS.ipa" "%REPO_DIR%\iOS-Release\SmartPOS-Pro-iOS.ipa" >nul
    rmdir /s /q "%TEMP%\smartpos_ipa"
    echo.
    echo ================================================================
    echo   SUCCES ! Le nouveau fichier .ipa a ete copie avec succes:
    echo   1. Sur votre Bureau: %USERPROFILE%\Desktop\SmartPOS-Pro-iOS.ipa
    echo   2. Dans le dossier: %REPO_DIR%\iOS-Release
    echo   Vous pouvez maintenant l'installer sur votre iPhone avec Sideloadly / AltStore / TrollStore !
    echo ================================================================
) else (
    echo.
    echo Ouverture de la page GitHub pour le telechargement manuel...
    "C:\Program Files\GitHub CLI\gh.exe" repo view --web
)

pause
