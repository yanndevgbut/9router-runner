#!/bin/bash

# =========================================================
# 9Router Pterodactyl Startup Script
# =========================================================

set -e

# Masuk ke direktori script
cd "$(dirname "$0")"

# Pastikan NodeJS terpasang
if ! command -v node &> /dev/null; then
    echo "[ERROR] NodeJS tidak ditemukan! Pastikan egg Pterodactyl Anda mendukung NodeJS (v18/v20/v22)."
    exit 1
fi

# Auto install node_modules jika belum ada
if [ ! -d "node_modules/9router" ]; then
    echo "[INFO] Mengunduh dependensi 9router..."
    npm install 9router --ignore-scripts --prefer-online --no-audit --no-fund
fi

# Jalankan Web UI launcher
exec node index.js
