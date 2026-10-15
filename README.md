# 9Router Multi-Platform Launcher (Railway & Pterodactyl)

Script otomatis untuk menjalankan **9Router Web UI** & API Gateway di platform cloud **Railway** maupun **Panel Pterodactyl** tanpa menu interaktif, dilengkapi auto-detect environment, zero-config port binding, dan dukungan persistent volume.

---

## 🚂 Panduan Deploy di Railway

### 1. Deploy dari GitHub
1. Push / import repository ini ke akun GitHub Anda.
2. Buka dashboard [Railway](https://railway.com) dan buat **New Project**.
3. Pilih **Deploy from GitHub repo**, lalu pilih repo ini.

### 2. Konfigurasi Persistent Volume (PENTING)
Railway menggunakan ephemeral disk (data hilang saat restart/redeploy). Agar database SQLite, API key, dan konfigurasi provider tersimpan permanen:
1. Buka service 9Router Anda di Railway.
2. Masuk ke menu **Settings** > scroll ke bawah ke bagian **Volumes**.
3. Klik **+ Add Volume**.
4. Set **Mount Path** ke: `/data`
5. Buka tab **Variables**, tambahkan variabel:
   ```text
   DATA_DIR=/data
   INITIAL_PASSWORD=PasswordAdminAndaYangKuat!
   ```

### 3. Generate Public Domain
1. Di service 9Router, masuk ke tab **Settings** > **Networking**.
2. Klik tombol **Generate Domain** (contoh: `xxxx.up.railway.app`) atau sambungkan Custom Domain Anda.
3. Akses layanan Anda:
   - **Dashboard**: `https://xxxx.up.railway.app/dashboard`
   - **API Endpoint**: `https://xxxx.up.railway.app/v1`

> 💡 **Catatan untuk Railway**: Cloudflare Tunnel otomatis dinonaktifkan di Railway karena Railway sudah menyediakan edge HTTPS domain bawaan.

---

## 🦅 Panduan Deploy di Pterodactyl Panel

### 1. Pengaturan di `config.js`
Buka file **`config.js`** di File Manager Pterodactyl:
```javascript
module.exports = {
  // Password login Dashboard 9Router
  INITIAL_PASSWORD: "PasswordAdmin123!",

  // Switch Mode Domain:
  // true  : Domain tetap Cloudflare (Zero Trust)
  // false : Quick Tunnel gratis (trycloudflare.com)
  USE_CUSTOM_DOMAIN: true,

  // Nama domain tetap Anda
  CUSTOM_DOMAIN: "yannrouter.biz.id",

  // Token Tunnel dari Cloudflare Zero Trust
  CLOUDFLARE_TUNNEL_TOKEN: "eyJhbGciOi...",

  // Aktifkan Tunnel publik
  TUNNEL: true,
};
```

### 2. Jalankan Server
- Startup Command: `node index.js` (atau jalankan via `bash start.sh`).
- Port server akan otomatis mendeteksi variabel `SERVER_PORT` / `PORT` dari Pterodactyl.

---

## 📂 Struktur File

```text
├── index.js          # Launcher cerdas (Auto Railway / Pterodactyl detector)
├── config.js         # File konfigurasi lokal
├── config.example.js # Template konfigurasi aman
├── railway.json      # Konfigurasi deploy & healthcheck Railway
├── nixpacks.toml     # Konfigurasi builder Nixpacks (Node 22)
├── Dockerfile        # Alternatif deployment container Docker
├── .dockerignore     # Filter ignore Docker
├── start.sh          # Script launcher Bash (Pterodactyl)
├── package.json      # Definisi paket 9router & engine
├── .gitignore        # Mengabaikan database, .env, dan log
└── data/             # Direktori database SQLite persistent
```

---

## ⚙️ Variabel Environment yang Didukung

| Variabel | Deskripsi | Default |
|---|---|---|
| `PORT` | Port server (diisi otomatis oleh Railway / Pterodactyl) | `3000` / `20128` |
| `DATA_DIR` | Lokasi folder database persistent SQLite | `./data` (set `/data` untuk Railway Volume) |
| `INITIAL_PASSWORD` | Password pertama login dashboard | `PasswordAdmin123!` |
| `TUNNEL` | Mengaktifkan Cloudflare Tunnel | Railway: `false`, Pterodactyl: `true` |
| `FORCE_TUNNEL` | Paksa Cloudflare Tunnel aktif di Railway | `false` |
| `USE_CUSTOM_DOMAIN` | Gunakan named tunnel Cloudflare | `false` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token Cloudflare Zero Trust | `""` |
| `MAX_OLD_SPACE_SIZE` | Alokasi heap V8 memory Node.js (MB) | Otomatis sesuai RAM |
