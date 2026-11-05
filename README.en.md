<h1 align="center">9Router Multi-Platform Launcher</h1>

<p align="center">
    <strong>Automated launcher for 9Router Web UI &amp; API Gateway</strong><br>
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

## Overview

**9Router Multi-Platform Launcher** is a launcher script for running the **9Router Web UI** and **API Gateway** on Railway or Pterodactyl Panel. It is designed to start the service without interactive menus and adapt to the environment in which it runs.

Its key capabilities include automatic environment detection, platform-provided port binding, configurable data directories, and optional Cloudflare Tunnel support for deployments that need it.

### Key features

- **Environment auto-detection** — detects Railway and Pterodactyl environments.
- **Automatic port binding** — reads the server port from `SERVER_PORT` or `PORT`.
- **Persistent data directory** — supports a configurable data path through `DATA_DIR`, including Railway Volumes.
- **Cloudflare Tunnel support** — supports both Quick Tunnel and named tunnels through Cloudflare Zero Trust.
- **Flexible startup** — can be started directly with Node.js or through a Bash script.
- **Deployment-ready configuration** — includes Railway, Nixpacks, and Docker deployment files.

---

## Table of Contents

- [Supported Platforms](#supported-platforms)
- [Deploy on Railway](#deploy-on-railway)
- [Deploy on Pterodactyl](#deploy-on-pterodactyl)
- [Environment Variables](#environment-variables)
- [File Structure](#file-structure)
- [Security Notes](#security-notes)
- [FAQ](#faq)

---

## Supported Platforms

| Platform | Status | Notes |
|---|---|---|
| Railway | Supported | A Persistent Volume mounted at `/data` is recommended. Railway can provide a public HTTPS domain. |
| Pterodactyl Panel | Supported | The server port is read from `SERVER_PORT` or `PORT`, as provided by the panel. Cloudflare Tunnel can be used for public access. |
| Docker | Configuration included | The repository includes a `Dockerfile` as an alternative container deployment option. |

---

## Deploy on Railway

### 1. Deploy the repository from GitHub

1. Push or import this repository into your GitHub account.
2. Open [Railway](https://railway.com) and create a **New Project**.
3. Select **Deploy from GitHub repo**.
4. Choose this launcher repository and start the deployment.

### 2. Add a Persistent Volume

> **Important:** Railway deployment filesystems are ephemeral. Application data stored outside a volume may be lost when the service restarts or is redeployed.

To keep the SQLite database, API keys, and provider configuration persistent:

1. Open your 9Router service in the Railway dashboard.
2. Go to **Settings** and find the **Volumes** section.
3. Click **Add Volume**.
4. Set the **Mount Path** to `/data`.
5. Open the **Variables** tab and add:

   ```env
   DATA_DIR=/data
   INITIAL_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD
   ```

`DATA_DIR=/data` directs the application's data directory to the mounted volume.

### 3. Generate a public domain

1. Open the 9Router service and go to **Settings** → **Networking**.
2. Click **Generate Domain**, or connect your own custom domain.
3. After deployment succeeds, access the service using that domain:

   | Service | URL |
   |---|---|
   | Dashboard | `https://<your-railway-domain>/dashboard` |
   | API Gateway | `https://<your-railway-domain>/v1` |

> **Railway note:** Cloudflare Tunnel is automatically disabled on Railway because the platform already provides a public domain with HTTPS. Set `FORCE_TUNNEL=true` only when you intentionally want to force the tunnel to run.

---

## Deploy on Pterodactyl

### 1. Configure `config.js`

Open **File Manager** in your Pterodactyl server, then create or edit `config.js`. You can use `config.example.js` as a configuration template.

Example configuration for a Cloudflare named tunnel:

```javascript
module.exports = {
  // Password used to log in to the 9Router Dashboard
  INITIAL_PASSWORD: "REPLACE_WITH_A_STRONG_PASSWORD",

  // true  = use a Cloudflare named tunnel
  // false = use a free Cloudflare Quick Tunnel (trycloudflare.com)
  USE_CUSTOM_DOMAIN: true,

  // Domain connected to your named tunnel
  CUSTOM_DOMAIN: "subdomain.your-domain.com",

  // Tunnel token from Cloudflare Zero Trust
  CLOUDFLARE_TUNNEL_TOKEN: "YOUR_CLOUDFLARE_TUNNEL_TOKEN",

  // Enable the public Cloudflare Tunnel
  TUNNEL: true,
};
```

Adjust these options to match your Cloudflare configuration:

| Option | Description |
|---|---|
| `INITIAL_PASSWORD` | Initial password for the 9Router Dashboard. |
| `USE_CUSTOM_DOMAIN` | Set to `true` for a named tunnel or `false` for a Quick Tunnel. |
| `CUSTOM_DOMAIN` | Domain routed to your named tunnel. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token issued by Cloudflare Zero Trust. |
| `TUNNEL` | Enables or disables Cloudflare Tunnel. |

### 2. Set the startup command

Use either of the following commands in your server's startup configuration:

```bash
node index.js
```

Or run the Bash launcher:

```bash
bash start.sh
```

The launcher detects the port from `SERVER_PORT` or `PORT`, as provided by Pterodactyl.

---

## Environment Variables

The launcher supports the following environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port. Railway or Pterodactyl may provide this automatically. | `3000` / `20128` |
| `DATA_DIR` | Directory used for application data and the SQLite database. | `./data` — set to `/data` for a Railway Volume. |
| `INITIAL_PASSWORD` | Initial password for the 9Router Dashboard. | `PasswordAdmin123!`* |
| `TUNNEL` | Enables Cloudflare Tunnel. | Railway: `false`; Pterodactyl: `true` |
| `FORCE_TUNNEL` | Forces Cloudflare Tunnel to run on Railway. | `false` |
| `USE_CUSTOM_DOMAIN` | Selects a Cloudflare named tunnel. | `false` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Zero Trust tunnel token. | Empty (`""`) |
| `MAX_OLD_SPACE_SIZE` | Node.js V8 heap memory limit, in MB. | Automatically based on available RAM |

\* **Important:** `PasswordAdmin123!` is the default value documented by the launcher configuration; it is not recommended for a public deployment. Replace it with a unique, strong password before exposing the dashboard to the internet.

---

## File Structure

```text
├── index.js          # Main launcher and Railway / Pterodactyl detector
├── config.js         # Local configuration file
├── config.example.js # Configuration template
├── railway.json      # Railway deployment and health check configuration
├── nixpacks.toml     # Nixpacks builder configuration (Node.js 22)
├── Dockerfile        # Docker deployment option
├── .dockerignore     # Files excluded from Docker builds
├── start.sh          # Bash launcher for Pterodactyl
├── package.json      # Package metadata and engine configuration
├── .gitignore        # Files and directories ignored by Git
└── data/             # Application data / SQLite database directory
```

---

## Security Notes

- Change the dashboard's default password before making the deployment public.
- Do not commit a `config.js` file containing passwords, Cloudflare Tunnel tokens, or other credentials to a public repository.
- Do not share your `CLOUDFLARE_TUNNEL_TOKEN`. Treat it like a password.
- Make sure `DATA_DIR` points to persistent storage on platforms that use ephemeral filesystems.
- Keep backups of important configuration and application data.

---

## FAQ

### Does Railway require a Persistent Volume?

A Persistent Volume is recommended. Mount it at `/data` and set `DATA_DIR=/data` so application data remains available after restarts or redeployments.

### Is Cloudflare Tunnel required on Railway?

No. Railway provides a public domain and HTTPS, so Cloudflare Tunnel is disabled automatically by default on Railway.

### How do I start the launcher on Pterodactyl?

Use `node index.js` or `bash start.sh` as the startup command. The port is detected from `SERVER_PORT` or `PORT`.

### What is the difference between a Quick Tunnel and a named tunnel?

A Quick Tunnel uses a temporary `trycloudflare.com` domain. A named tunnel uses a domain configured through Cloudflare Zero Trust.

---

<p align="center">
  <sub>9Router Multi-Platform Launcher · Railway &amp; Pterodactyl</sub>
</p>
