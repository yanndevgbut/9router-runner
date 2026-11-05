<h1 align="center">9Router Multi-Platform Launcher</h1>

<p align="center">
    <strong>Launcher otomatis untuk 9Router Web UI &amp; API Gateway</strong><br>
    Railway · Pterodactyl · Node.js
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Railway-supported-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Railway supported">
  <img src="https://img.shields.io/badge/Pterodactyl-supported-10539F?style=for-the-badge&logo=pterodactyl&logoColor=white" alt="Pterodactyl supported">
  <img src="https://img.shields.io/badge/Node.js-runtime-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
</p>

<p align="center">
  <a href="README.md">🇮🇩 Bahasa Indonesia</a> · <a href="README.en.md">🇬🇧 English</a>
</p>

---

## Ringkasan

**9Router Multi-Platform Launcher** adalah script launcher untuk menjalankan **9Router Web UI** dan **API Gateway** pada Railway maupun Pterodactyl Panel. Launcher ini dirancang agar proses startup tidak memerlukan menu interaktif dan dapat menyesuaikan diri dengan environment tempat aplikasi dijalankan.

Fitur utamanya mencakup deteksi environment otomatis, penggunaan port dari environment platform, pengaturan direktori data, serta dukungan Cloudflare Tunnel untuk deployment yang membutuhkannya.

### Fitur utama

- **Auto-detect environment** — mengenali environment Railway dan Pterodactyl.
- **Automatic port binding** — membaca konfigurasi port dari `SERVER_PORT` atau `PORT`.
- **Persistent data directory** — mendukung direktori data khusus melalui `DATA_DIR`, termasuk Railway Volume.
- **Cloudflare Tunnel** — mendukung Quick Tunnel maupun named tunnel dengan Cloudflare Zero Trust.
- **Flexible startup** — dapat dijalankan langsung melalui Node.js atau script Bash.
- **Deployment-ready** — menyertakan konfigurasi Railway, Nixpacks, dan Docker.

---

## Daftar Isi

- [Platform yang Didukung](#platform-yang-didukung)
- [Deploy di Railway](#deploy-di-railway)
- [Deploy di Pterodactyl](#deploy-di-pterodactyl)
- [Variabel Environment](#variabel-environment)
- [Struktur File](#struktur-file)
- [Catatan Keamanan](#catatan-keamanan)
- [FAQ](#faq)

---

## Platform yang Didukung

| Platform | Status | Catatan |
|---|---|---|
| Railway | Didukung | Disarankan menggunakan Persistent Volume dengan mount path `/data`. Domain HTTPS dapat dibuat dari Railway. |
| Pterodactyl Panel | Didukung | Port akan mengikuti `SERVER_PORT` atau `PORT` yang disediakan panel. Cloudflare Tunnel dapat digunakan untuk akses publik. |
| Docker | Konfigurasi tersedia | Repository menyertakan `Dockerfile` sebagai opsi deployment container. |

---

## Deploy di Railway

### 1. Deploy repository dari GitHub

1. Push atau import repository ini ke akun GitHub Anda.
2. Buka [Railway](https://railway.com), lalu buat **New Project**.
3. Pilih **Deploy from GitHub repo**.
4. Pilih repository launcher ini dan mulai proses deployment.

### 2. Tambahkan Persistent Volume

> **Penting:** filesystem pada deployment Railway bersifat ephemeral. Data aplikasi yang disimpan di luar volume dapat hilang ketika service di-restart atau di-deploy ulang.

Agar database SQLite, API key, dan konfigurasi provider tetap tersimpan:

1. Buka service 9Router di dashboard Railway.
2. Masuk ke **Settings**, lalu cari bagian **Volumes**.
3. Klik **Add Volume**.
4. Atur **Mount Path** menjadi `/data`.
5. Buka tab **Variables**, lalu tambahkan:

   ```env
   DATA_DIR=/data
   INITIAL_PASSWORD=GANTI_DENGAN_PASSWORD_YANG_KUAT
   ```

`DATA_DIR=/data` memastikan direktori data aplikasi diarahkan ke volume yang sudah dipasang.

### 3. Buat public domain

1. Buka service 9Router, lalu masuk ke **Settings** → **Networking**.
2. Klik **Generate Domain**, atau hubungkan custom domain milik Anda.
3. Setelah deployment berhasil, akses layanan melalui domain tersebut:

   | Layanan | URL |
   |---|---|
   | Dashboard | `https://<domain-railway-anda>/dashboard` |
   | API Gateway | `https://<domain-railway-anda>/v1` |

> **Catatan Railway:** Cloudflare Tunnel dinonaktifkan secara otomatis pada Railway karena platform ini sudah menyediakan domain publik dengan HTTPS. Gunakan `FORCE_TUNNEL=true` hanya bila Anda memang ingin memaksa Tunnel aktif.

---

## Deploy di Pterodactyl

### 1. Atur `config.js`

Buka **File Manager** pada server Pterodactyl, lalu buat atau edit file `config.js`. Anda dapat menggunakan `config.example.js` sebagai referensi konfigurasi.

Contoh konfigurasi untuk menggunakan Cloudflare named tunnel:

```javascript
module.exports = {
  // Password untuk login ke Dashboard 9Router
  INITIAL_PASSWORD: "GANTI_DENGAN_PASSWORD_YANG_KUAT",

  // true  = menggunakan Cloudflare named tunnel
  // false = menggunakan Cloudflare Quick Tunnel (trycloudflare.com)
  USE_CUSTOM_DOMAIN: true,

  // Domain yang terhubung ke named tunnel
  CUSTOM_DOMAIN: "subdomain.domain-anda.com",

  // Token tunnel dari Cloudflare Zero Trust
  CLOUDFLARE_TUNNEL_TOKEN: "ISI_TOKEN_CLOUDFLARE_ANDA",

  // Mengaktifkan Cloudflare Tunnel
  TUNNEL: true,
};
```

Sesuaikan nilai berikut dengan konfigurasi Cloudflare Anda:

| Opsi | Fungsi |
|---|---|
| `INITIAL_PASSWORD` | Password awal untuk login ke Dashboard 9Router. |
| `USE_CUSTOM_DOMAIN` | `true` untuk named tunnel atau `false` untuk Quick Tunnel. |
| `CUSTOM_DOMAIN` | Domain yang diarahkan ke named tunnel. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token dari Cloudflare Zero Trust. |
| `TUNNEL` | Mengaktifkan atau menonaktifkan Cloudflare Tunnel. |

### 2. Atur startup command

Gunakan salah satu perintah berikut pada pengaturan startup server:

```bash
node index.js
```

Atau jalankan launcher Bash:

```bash
bash start.sh
```

Launcher akan mendeteksi port dari `SERVER_PORT` atau `PORT` yang disediakan oleh Pterodactyl.

---

## Variabel Environment

Launcher mendukung variabel environment berikut:

| Variabel | Deskripsi | Default |
|---|---|---|
| `PORT` | Port HTTP server. Dapat diisi otomatis oleh Railway atau Pterodactyl. | `3000` / `20128` |
| `DATA_DIR` | Lokasi direktori penyimpanan data dan database SQLite. | `./data` — gunakan `/data` untuk Railway Volume. |
| `INITIAL_PASSWORD` | Password awal untuk login Dashboard 9Router. | `PasswordAdmin123!`* |
| `TUNNEL` | Mengaktifkan Cloudflare Tunnel. | Railway: `false`; Pterodactyl: `true` |
| `FORCE_TUNNEL` | Memaksa Cloudflare Tunnel tetap aktif di Railway. | `false` |
| `USE_CUSTOM_DOMAIN` | Memilih named tunnel Cloudflare. | `false` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token Cloudflare Zero Trust. | Kosong (`""`) |
| `MAX_OLD_SPACE_SIZE` | Batas heap memory V8 untuk Node.js dalam MB. | Otomatis berdasarkan RAM |

\* **Penting:** `PasswordAdmin123!` adalah nilai default yang tercantum pada konfigurasi launcher, bukan password yang disarankan untuk deployment publik. Ganti dengan password unik dan kuat sebelum membuka dashboard ke internet.

---

## Struktur File

```text
├── index.js          # Launcher utama dan pendeteksi Railway / Pterodactyl
├── config.js         # Konfigurasi lokal
├── config.example.js # Template konfigurasi
├── railway.json      # Konfigurasi deployment dan health check Railway
├── nixpacks.toml     # Konfigurasi Nixpacks (Node.js 22)
├── Dockerfile        # Opsi deployment menggunakan Docker
├── .dockerignore     # Daftar file yang diabaikan saat build Docker
├── start.sh          # Script launcher Bash untuk Pterodactyl
├── package.json      # Metadata package dan konfigurasi engine
├── .gitignore        # File dan direktori yang diabaikan Git
└── data/             # Direktori data / database SQLite
```

---

## Catatan Keamanan

- Ganti password default dashboard sebelum deployment dipublikasikan.
- Jangan commit `config.js` yang berisi password, Cloudflare Tunnel token, atau kredensial lainnya ke repository publik.
- Jangan membagikan `CLOUDFLARE_TUNNEL_TOKEN`. Perlakukan token tersebut seperti password.
- Pastikan `DATA_DIR` diarahkan ke persistent storage pada platform yang menggunakan filesystem ephemeral.
- Simpan salinan konfigurasi dan data penting secara berkala.

---

## FAQ

### Apakah Railway memerlukan Persistent Volume?

Ya, disarankan. Gunakan volume dengan mount path `/data`, lalu atur `DATA_DIR=/data` agar data aplikasi tetap tersedia setelah restart atau redeploy.

### Apakah Cloudflare Tunnel wajib digunakan di Railway?

Tidak. Railway menyediakan public domain dan HTTPS. Karena itu, Cloudflare Tunnel dinonaktifkan secara otomatis secara default pada Railway.

### Bagaimana cara menjalankan launcher di Pterodactyl?

Gunakan startup command `node index.js` atau `bash start.sh`. Port akan dideteksi dari `SERVER_PORT` atau `PORT`.

### Apa perbedaan Quick Tunnel dan named tunnel?

Quick Tunnel menggunakan domain sementara `trycloudflare.com`. Named tunnel menggunakan domain yang Anda konfigurasi melalui Cloudflare Zero Trust.

---

<p align="center">
  <sub>9Router Multi-Platform Launcher · Railway &amp; Pterodactyl</sub>
</p>
