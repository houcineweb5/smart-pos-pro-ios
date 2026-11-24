@echo off
chcp 65001 >nul
title SmartPOS Pro - Build Final Release Installer
cd /d "%~dp0"
node "%~dp0scripts\build_installer.cjs"
echo.
pause
