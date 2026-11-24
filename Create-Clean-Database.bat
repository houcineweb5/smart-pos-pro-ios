@echo off
chcp 65001 >nul
title SmartPOS Pro - Clean Database Tool
cd /d "%~dp0"
node "%~dp0scripts\create_clean_production_db.cjs" --interactive
if errorlevel 1 (
    echo.
    pause
)
