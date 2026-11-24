@echo off
REM Launch the guide via local PowerShell server (bypasses CORS)
title OSRS Guide ^| server running
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
