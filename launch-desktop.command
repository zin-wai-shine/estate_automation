#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# BoltHaven Property Automation - Native Mac Desktop Launcher
# Double-click this file in Finder to open the workflow canvas in a Mac window!
# ------------------------------------------------------------------------------

unset ELECTRON_RUN_AS_NODE
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=================================================="
echo "🚀 Launching BoltHaven Mac Desktop App..."
echo "=================================================="

npm --prefix frontend run desktop
