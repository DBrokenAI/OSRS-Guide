@echo off
REM Launch the guide via local PowerShell server (bypasses CORS)
title bvels10's OSRS Guide ^| server running
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
