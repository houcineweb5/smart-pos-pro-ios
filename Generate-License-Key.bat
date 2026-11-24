@echo off
chcp 65001 >nul
title SmartPOS Pro - License Key Generator
cd /d "%~dp0"
node "%~dp0scripts\generate_license.cjs"
if errorlevel 1 (
    echo.
    pause
)
