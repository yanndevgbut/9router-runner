#!/usr/bin/env node

/**
 * 9Router Pterodactyl Auto-Launcher
 * Direct Web UI Runner + Auto Cloudflare Tunnel (Named Domain & Quick Tunnel)
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn, execSync } = require('child_process');

// Breadcrumb log di data/boot.log (untuk diagnosa crash saat console tidak terjangkau)
// Deteksi platform (Railway vs Pterodactyl / Standalone)
const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.RAILWAY_PUBLIC_DOMAIN
);

// Breadcrumb log di data/boot.log (dengan batas ukuran 1MB)
const bootLogFile = path.join(__dirname, 'data', 'boot.log');
function bootLog(msg) {
  try {
    fs.mkdirSync(path.dirname(bootLogFile), { recursive: true });
    if (fs.existsSync(bootLogFile) && fs.statSync(bootLogFile).size > 1024 * 1024) {
      fs.truncateSync(bootLogFile, 0);
    }
    fs.appendFileSync(bootLogFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}
bootLog(`=== index.js START (platform: ${isRailway ? 'Railway' : 'Standalone/Pterodactyl'}) ===`);

let child = null;
let tunnelProcess = null;

process.on('uncaughtException', (e) => {
  bootLog('UNCAUGHT_EXCEPTION: ' + (e && e.stack ? e.stack : String(e)));
  if (child && !child.killed) try { child.kill('SIGTERM'); } catch {}
  if (tunnelProcess && !tunnelProcess.killed) try { tunnelProcess.kill('SIGTERM'); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  bootLog('UNHANDLED_REJECTION: ' + (e && e.stack ? e.stack : String(e)));
  if (child && !child.killed) try { child.kill('SIGTERM'); } catch {}
  if (tunnelProcess && !tunnelProcess.killed) try { tunnelProcess.kill('SIGTERM'); } catch {}
  process.exit(1);
});
process.on('exit', (code) => bootLog(`=== index.js EXIT code=${code} ===`));

console.log('\x1b[36m==================================================\x1b[0m');
if (isRailway) {
  console.log('\x1b[1m\x1b[32m🚂 9Router Railway Cloud Launcher\x1b[0m');
} else {
  console.log('\x1b[1m\x1b[32m🚀 9Router Pterodactyl Auto-Launcher\x1b[0m');
}
console.log('\x1b[36m==================================================\x1b[0m');

// Catat apakah env TUNNEL diset eksplisit dari OS/Platform sebelum load config.js
const envTunnelExplicit = process.env.TUNNEL !== undefined || process.env.ENABLE_TUNNEL !== undefined;

// 0. Auto-load config.js and .env file if present
const configFiles = [path.join(__dirname, 'config.js'), path.join(process.cwd(), 'config.js')];
for (const cfgFile of configFiles) {
  if (fs.existsSync(cfgFile)) {
    try {
      const userConfig = require(cfgFile);
      if (typeof userConfig === 'object' && userConfig !== null) {
        for (const [k, v] of Object.entries(userConfig)) {
          if (v !== undefined && v !== null && !process.env[k]) {
            process.env[k] = String(v);
          }
        }
        console.log(`⚙️  Membaca konfigurasi dari: \x1b[32mconfig.js\x1b[0m`);
      bootLog(`config.js loaded. AUTO_UPDATE(raw)=${JSON.stringify(process.env.AUTO_UPDATE)} TUNNEL=${JSON.stringify(process.env.TUNNEL)} USE_CUSTOM_DOMAIN=${JSON.stringify(process.env.USE_CUSTOM_DOMAIN)}`);
      }
      break;
    } catch (e) {
      console.warn('⚠️  Gagal membaca config.js:', e.message);
    }
  }
}

const envFiles = [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...values] = trimmed.split('=');
          const k = key.trim();
          const v = values.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[k]) process.env[k] = v;
        }
      });
      console.log(`📄 Membaca konfigurasi dari: ${envFile}`);
      break;
    } catch (e) {}
  }
}

// 0.5. Auto-Update System 9Router (via config.js: AUTO_UPDATE)
const updaterCacheFile = path.join(__dirname, 'data', 'updater.json');

function readUpdaterCache() {
  try {
    if (fs.existsSync(updaterCacheFile)) return JSON.parse(fs.readFileSync(updaterCacheFile, 'utf8'));
  } catch {}
  return {};
}

function writeUpdaterCache(cache) {
  try {
    fs.mkdirSync(path.dirname(updaterCacheFile), { recursive: true });
    fs.writeFileSync(updaterCacheFile, JSON.stringify(cache, null, 2));
  } catch {}
}

function getInstalled9RouterVersion() {
  try {
    const pkgPath = path.join(__dirname, 'node_modules', '9router', 'package.json');
    if (fs.existsSync(pkgPath)) return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
  } catch {}
  return null;
}

function checkAndUpdate9Router() {
  if (isRailway && !['true', '1', 'yes'].includes(String(process.env.FORCE_AUTO_UPDATE || '').toLowerCase())) {
    console.log('ℹ️  Railway environment terdeteksi → melewati auto-update saat startup.');
    bootLog('auto-update: SKIPPED (Railway detected, update handled via redeploy/git)');
    return;
  }

  const autoUpdate = ['true', '1', 'yes', 'on'].includes(String(process.env.AUTO_UPDATE || '').toLowerCase());
  if (!autoUpdate) {
    console.log('ℹ️  AUTO_UPDATE: false → melewati cek update 9Router');
    bootLog('auto-update: SKIPPED (AUTO_UPDATE=' + JSON.stringify(process.env.AUTO_UPDATE) + ')');
    return;
  }

  console.log('🔍 Memeriksa update 9Router...');
  bootLog('auto-update: CHECK START');

  const cache = readUpdaterCache();
  const intervalMs = (parseFloat(process.env.UPDATE_CHECK_INTERVAL_HOURS) || 6) * 3600 * 1000;
  if (cache.lastCheck && (Date.now() - cache.lastCheck) < intervalMs) {
    const mins = Math.round((Date.now() - cache.lastCheck) / 60000);
    console.log(`ℹ️  Cek update terakhir ${mins} menit lalu → skip (cek ulang tiap ${(intervalMs / 3600000)} jam)`);
    bootLog(`auto-update: SKIPPED (checked ${mins} min ago)`);
    return;
  }

  const installedVersion = getInstalled9RouterVersion();
  let latestVersion = null;
  try {
    const out = execSync('curl -fsSL --max-time 8 https://registry.npmjs.org/9router/latest', { encoding: 'utf8', timeout: 10000 });
    latestVersion = JSON.parse(out).version || null;
  } catch (e) {
    console.warn('⚠️  Tidak dapat mengecek versi terbaru (offline/timeout). Memakai versi terinstal.');
    bootLog('auto-update: REGISTRY CHECK FAILED: ' + e.message);
    writeUpdaterCache({ lastCheck: Date.now(), installedVersion });
    return;
  }

  if (installedVersion && latestVersion && installedVersion === latestVersion) {
    console.log(`✅ 9Router sudah versi terbaru (v${installedVersion}).`);
    bootLog(`auto-update: UP-TO-DATE v${installedVersion}`);
    writeUpdaterCache({ lastCheck: Date.now(), installedVersion });
    return;
  }

  try {
    console.log(`🔄 Update tersedia: ${installedVersion ? 'v' + installedVersion : '(belum terinstal)'} → v${latestVersion}`);
    console.log('⏳ Mengupdate 9Router... (mohon tunggu)');
    bootLog(`auto-update: UPDATING ${installedVersion} -> ${latestVersion}`);
    execSync('npm install 9router@latest --ignore-scripts --prefer-online --no-audit --no-fund', {
      stdio: 'inherit',
      cwd: __dirname,
      timeout: 120000
    });
    console.log(`✅ 9Router berhasil di-update ke v${latestVersion}`);
    bootLog(`auto-update: UPDATE OK -> v${latestVersion}`);
    writeUpdaterCache({ lastCheck: Date.now(), installedVersion: latestVersion });
  } catch (updateErr) {
    console.warn(`⚠️  Update gagal (${updateErr.message}). Memakai versi terinstal.`);
    bootLog('auto-update: UPDATE FAILED: ' + updateErr.message.split('\n')[0]);
    writeUpdaterCache({ lastCheck: Date.now(), installedVersion });
  }
}

checkAndUpdate9Router();

// 1. Resolve 9router package
let routerPkgPath;
const localPkg = path.join(__dirname, 'node_modules', '9router', 'package.json');
const cwdPkg = path.join(process.cwd(), 'node_modules', '9router', 'package.json');

if (fs.existsSync(localPkg)) {
  routerPkgPath = localPkg;
} else if (fs.existsSync(cwdPkg)) {
  routerPkgPath = cwdPkg;
} else {
  try {
    routerPkgPath = require.resolve('9router/package.json', { paths: [__dirname, process.cwd()] });
  } catch (e) {
    console.log('⏳ 9Router package belum terpasang. Menginstall 9router...');
    try {
      execSync('npm install 9router --ignore-scripts --prefer-online --no-audit --no-fund', {
        stdio: 'inherit',
        cwd: __dirname
      });
      routerPkgPath = path.join(__dirname, 'node_modules', '9router', 'package.json');
    } catch (installErr) {
      console.error('\x1b[31m❌ Gagal menginstall 9router:\x1b[0m', installErr.message);
      bootLog('INSTALL FAILED: ' + installErr.message.split('\n')[0]);
      process.exit(1);
    }
  }
}

const routerRoot = path.dirname(routerPkgPath);
const pkgInfo = require(routerPkgPath);
console.log(`📦 9Router Version : \x1b[33mv${pkgInfo.version || 'latest'}\x1b[0m`);
console.log(`📁 9Router Location: ${routerRoot}`);
bootLog(`9router resolved: v${pkgInfo.version} at ${routerRoot}`);

// 2. Setup Persistent Data Directory
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
process.env.DATA_DIR = dataDir;
console.log(`💾 Data Directory  : ${dataDir}`);
if (isRailway) {
  if (!process.env.DATA_DIR) {
    console.log('\x1b[33m⚠️  [Railway Volume Notice] DATA_DIR belum diset ke Railway Volume!\x1b[0m');
    console.log('\x1b[33m   Data akan hilang saat redeploy kecuali Anda memasang Railway Volume (mount ke /data dan set DATA_DIR=/data).\x1b[0m');
  } else {
    console.log(`✅ [Railway Volume] Persistent volume aktif di: ${dataDir}`);
  }
}

// 3. Initialize Environment & Runtime
let envWithRuntime = { ...process.env };
try {
  const sqliteRuntime = require(path.join(routerRoot, 'hooks', 'sqliteRuntime'));
  envWithRuntime = sqliteRuntime.buildEnvWithRuntime(process.env);
} catch (e) {
  const bundledNm = path.join(routerRoot, 'app', 'node_modules');
  const existing = process.env.NODE_PATH || '';
  envWithRuntime.NODE_PATH = [bundledNm, existing].filter(Boolean).join(path.delimiter);
}

// 4. Resolve App Directory and Entry Point
const appDir = path.join(routerRoot, 'app');
const customServerPath = path.join(appDir, 'custom-server.js');
const serverScript = fs.existsSync(customServerPath) ? customServerPath : path.join(appDir, 'server.js');

// 5. Determine Port & Force Host 0.0.0.0 for Docker / Railway Container
// Di Railway, PORT di-inject secara dinamis oleh platform
const port = isRailway
  ? (process.env.PORT || '3000')
  : (process.env.SERVER_PORT || process.env.PORT || '20128');
const host = '0.0.0.0'; // Selalu bind ke 0.0.0.0 agar bisa diakses dari luar container

const railwayDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const displayHost = isRailway
  ? (railwayDomain || `localhost:${port}`)
  : (process.env.SERVER_IP || process.env.P_SERVER_LOCATION || 'localhost');

const useCustomDomain = ['true', '1', 'yes', 'on'].includes(
  String(process.env.USE_CUSTOM_DOMAIN || process.env.USE_PERMANENT_DOMAIN || '').toLowerCase()
);
const customDomainName = process.env.CUSTOM_DOMAIN || process.env.PERMANENT_DOMAIN || 'yannrouter.biz.id';
const tunnelToken = (process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || '').trim();

let enableTunnel;
if (isRailway) {
  // Di Railway, public HTTPS domain sudah otomatis disediakan oleh Railway Edge.
  // Cloudflare Tunnel hanya dijalankan jika user sengaja memaksa dengan FORCE_TUNNEL=true
  // atau eksplisit memasang TUNNEL=true di Variables Railway dashboard.
  const forced = ['true', '1', 'yes'].includes(String(process.env.FORCE_TUNNEL || '').toLowerCase());
  const envEnabled = envTunnelExplicit && ['true', '1', 'yes'].includes(String(process.env.TUNNEL || '').toLowerCase());
  enableTunnel = forced || envEnabled;
} else {
  enableTunnel = !['false', '0', 'no', 'off'].includes(
    String(process.env.TUNNEL || process.env.ENABLE_TUNNEL || 'true').toLowerCase()
  ) && !['true', '1', 'yes'].includes(String(process.env.DISABLE_TUNNEL || '').toLowerCase());
}

console.log('\x1b[36m--------------------------------------------------\x1b[0m');
if (isRailway) {
  console.log(`🚂 Platform       : \x1b[32mRailway Cloud\x1b[0m`);
  console.log(`🔌 Port Server    : \x1b[33m${port}\x1b[0m (PORT dinamis Railway)`);
  console.log(`🌐 Host Bind      : \x1b[33m${host} (All Interfaces)\x1b[0m`);
  if (railwayDomain) {
    console.log(`🌐 Public URL     : \x1b[32mhttps://${railwayDomain}\x1b[0m`);
    console.log(`📊 Dashboard UI   : \x1b[36mhttps://${railwayDomain}/dashboard\x1b[0m`);
    console.log(`🔗 Direct API     : \x1b[36mhttps://${railwayDomain}/v1\x1b[0m`);
  } else {
    console.log(`ℹ️  Public Domain  : \x1b[33mBelum terpasang domain publik\x1b[0m`);
    console.log(`   (Buka Service -> Settings -> Networking -> 'Generate Domain' di Railway)`);
    console.log(`📊 Dashboard UI   : \x1b[36mhttp://localhost:${port}/dashboard\x1b[0m`);
  }
  if (!enableTunnel) {
    console.log(`🛡️  Tunnel Mode    : \x1b[35mRailway Edge Proxy (Cloudflare Tunnel dinonaktifkan)\x1b[0m`);
  } else {
    console.log(`🏷️  Tunnel Mode    : \x1b[35mCloudflare Tunnel Aktif (${useCustomDomain ? customDomainName : 'Quick Tunnel'})\x1b[0m`);
  }
} else {
  console.log(`⚡ Mode           : \x1b[32mDirect Web UI (Non-Interactive)\x1b[0m`);
  console.log(`🔌 Port Server    : \x1b[33m${port}\x1b[0m (SERVER_PORT / PORT)`);
  console.log(`🌐 Host Bind      : \x1b[33m${host} (All Interfaces)\x1b[0m`);
  console.log(`🏷️  Domain Mode    : \x1b[35m${useCustomDomain ? `Domain Tetap (${customDomainName})` : 'Quick Tunnel Acak'}\x1b[0m`);
  console.log(`📊 Direct URL     : \x1b[36mhttp://${displayHost}:${port}/dashboard\x1b[0m`);
  console.log(`🔗 Direct API     : \x1b[36mhttp://${displayHost}:${port}/v1\x1b[0m`);
}
console.log('\x1b[36m==================================================\x1b[0m\n');

// 6. Spawn Next.js Standalone Server in Foreground
const nodeArgs = ['--dns-result-order=ipv4first'];
if (process.env.MAX_OLD_SPACE_SIZE) {
  nodeArgs.push(`--max-old-space-size=${process.env.MAX_OLD_SPACE_SIZE}`);
} else if (process.env.SERVER_MEMORY) {
  const mem = parseInt(process.env.SERVER_MEMORY, 10);
  if (!isNaN(mem) && mem > 512) {
    nodeArgs.push(`--max-old-space-size=${Math.floor(mem * 0.8)}`);
  }
} else if (!isRailway) {
  nodeArgs.push('--max-old-space-size=4096');
}
nodeArgs.push(serverScript);

bootLog(`spawning server: node ${nodeArgs.join(' ')} (port=${port})`);
child = spawn(process.execPath, nodeArgs, {
  cwd: appDir,
  stdio: 'inherit',
  env: {
    ...envWithRuntime,
    PORT: port.toString(),
    HOSTNAME: host,
    DATA_DIR: dataDir,
    NODE_ENV: 'production'
  }
});

// 7. Auto Self-Healthcheck function
function runSelfHealthCheck(targetPort, maxAttempts = 15) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const req = http.get({
      hostname: '127.0.0.1',
      port: targetPort,
      path: '/api/health',
      timeout: 1500
    }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 308) {
        clearInterval(timer);
        console.log(`\x1b[32m[Self-Check OK]\x1b[0m Server 9Router aktif & merespon di dalam container (Port ${targetPort}).`);
      }
    });

    req.on('error', () => {
      if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    });

    req.on('timeout', () => {
      req.destroy();
    });
  }, 1000);
}

// Download file helper (mengikuti redirect)
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    try {
      execSync(`curl -fsSL -o "${dest}" "${url}"`, { stdio: 'ignore' });
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        return resolve();
      }
    } catch (e) {}

    const getUrl = (currentUrl) => {
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return getUrl(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download gagal dengan status HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
        file.on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }).on('error', (err) => reject(err));
    };
    getUrl(url);
  });
}

// 8. Cloudflare Tunnel Manager (Named Tunnel vs Quick Tunnel)
async function startCloudflareTunnel(targetPort) {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const binName = `cloudflared-linux-${arch}`;
  
  // Utamakan /tmp untuk memastikan permission execute (+x) selalu diizinkan oleh OS
  const primaryBinPath = path.join('/tmp', binName);
  const fallbackBinPath = path.join(dataDir, 'bin', binName);
  let binPath = primaryBinPath;

  const ensureExecutable = (target) => {
    try { fs.chmodSync(target, 0o755); return true; } catch (e) { return false; }
  };

  if (!fs.existsSync(binPath) || fs.statSync(binPath).size < 1000) {
    if (fs.existsSync(fallbackBinPath) && fs.statSync(fallbackBinPath).size > 1000) {
      try {
        fs.copyFileSync(fallbackBinPath, binPath);
        ensureExecutable(binPath);
      } catch (e) {
        binPath = fallbackBinPath;
      }
    } else {
      console.log(`\x1b[35m[Tunnel]\x1b[0m Mengunduh cloudflared binary (${arch})...`);
      try {
        const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
        await downloadFile(url, binPath);
        ensureExecutable(binPath);
        console.log('\x1b[35m[Tunnel]\x1b[0m Cloudflared binary siap.');
      } catch (e) {
        console.error('\x1b[31m[Tunnel] Gagal mengunduh cloudflared:\x1b[0m', e.message);
        return null;
      }
    }
  } else {
    ensureExecutable(binPath);
  }

  // A. Jika USE_CUSTOM_DOMAIN: true dan CLOUDFLARE_TUNNEL_TOKEN terisi -> Jalankan Named Tunnel
  if (useCustomDomain && tunnelToken) {
    console.log(`\x1b[35m[Tunnel]\x1b[0m Menghubungkan ke Cloudflare Named Tunnel: \x1b[36m${customDomainName}\x1b[0m`);
    console.log('\n\x1b[1m\x1b[32m==================================================\x1b[0m');
    console.log('\x1b[1m\x1b[32m🎉 CLOUDFLARE NAMED TUNNEL (DOMAIN TETAP):\x1b[0m');
    console.log(`\x1b[1m\x1b[36m📊 Dashboard UI : https://${customDomainName}/dashboard\x1b[0m`);
    console.log(`\x1b[1m\x1b[36m🔗 API Endpoint : https://${customDomainName}/v1\x1b[0m`);
    console.log('\x1b[1m\x1b[32m==================================================\x1b[0m\n');

    try {
      // Menggunakan --protocol http2 di level command tunnel agar tidak terblokir oleh UDP/QUIC firewall hosting
      const tunnel = spawn(binPath, [
        'tunnel',
        '--protocol', 'http2',
        '--no-autoupdate',
        'run',
        '--token', tunnelToken
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const handleNamedOutput = (chunk) => {
        const text = chunk.toString();
        text.split(/\r?\n/).forEach((line) => {
          const l = line.trim();
          if (l) {
            // Saring dan beri warna log tunnel
            if (l.toLowerCase().includes('err') || l.toLowerCase().includes('fail') || l.toLowerCase().includes('invalid')) {
              console.log(`\x1b[31m[Tunnel Error]\x1b[0m ${l}`);
            } else {
              console.log(`\x1b[35m[Tunnel]\x1b[0m ${l}`);
            }
          }
        });
      };

      tunnel.stdout.on('data', handleNamedOutput);
      tunnel.stderr.on('data', handleNamedOutput);

      tunnel.on('error', (err) => {
        console.warn('\x1b[33m[Tunnel Notice]\x1b[0m Gagal spawn tunnel binary:', err.message);
      });

      return tunnel;
    } catch (err) {
      console.warn('\x1b[33m[Tunnel Notice]\x1b[0m Gagal memulai Named Tunnel:', err.message);
      return null;
    }
  }

  if (useCustomDomain && !tunnelToken) {
    console.log(`\x1b[33m[Tunnel Notice]\x1b[0m USE_CUSTOM_DOMAIN di-set TRUE tapi CLOUDFLARE_TUNNEL_TOKEN belum diisi.`);
    console.log(`\x1b[33m[Tunnel Notice]\x1b[0m Menggunakan Quick Tunnel acak sebagai fallback...\n`);
  }

  // B. Fallback / Mode FALSE -> Cloudflare Quick Tunnel (Domain Acak trycloudflare.com)
  console.log('\x1b[35m[Tunnel]\x1b[0m Memulai Cloudflare Quick Tunnel (Domain Acak)...');
  try {
    const tunnel = spawn(binPath, [
      'tunnel',
      '--url', `http://127.0.0.1:${targetPort}`,
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let tunnelUrlFound = false;
    const handleOutput = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrlFound) {
        tunnelUrlFound = true;
        const publicUrl = match[0];
        console.log('\n\x1b[1m\x1b[32m==================================================\x1b[0m');
        console.log('\x1b[1m\x1b[32m🎉 CLOUDFLARE PUBLIC URL (QUICK TUNNEL):\x1b[0m');
        console.log(`\x1b[1m\x1b[36m📊 Dashboard UI : ${publicUrl}/dashboard\x1b[0m`);
        console.log(`\x1b[1m\x1b[36m🔗 API Endpoint : ${publicUrl}/v1\x1b[0m`);
        console.log('\x1b[1m\x1b[32m==================================================\x1b[0m\n');
      }
    };

    tunnel.stdout.on('data', handleOutput);
    tunnel.stderr.on('data', handleOutput);

    tunnel.on('error', (err) => {
      console.warn('\x1b[33m[Tunnel Notice]\x1b[0m Gagal spawn tunnel binary:', err.message);
    });

    return tunnel;
  } catch (err) {
    console.warn('\x1b[33m[Tunnel Notice]\x1b[0m Gagal memulai Quick Tunnel:', err.message);
    return null;
  }
}

// Start health check and tunnel
runSelfHealthCheck(port);

if (enableTunnel) {
  setTimeout(async () => {
    tunnelProcess = await startCloudflareTunnel(port);
  }, 1000);
}

child.on('error', (err) => {
  console.error('\x1b[31m❌ Gagal menjalankan server 9Router:\x1b[0m', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  bootLog(`child server exited: code=${code} signal=${signal}`);
  if (tunnelProcess && !tunnelProcess.killed) {
    try { tunnelProcess.kill('SIGKILL'); } catch {}
  }
  if (signal) {
    console.log(`\n🛑 9Router dihentikan oleh sinyal: ${signal}`);
  } else {
    console.log(`\n🛑 9Router server berhenti dengan exit code: ${code}`);
  }
  process.exit(code || 0);
});

// Graceful termination handling
const handleTermination = (signal) => {
  console.log(`\nMenerima ${signal}, mematikan server secara bersih...`);
  if (tunnelProcess && !tunnelProcess.killed) {
    try { tunnelProcess.kill('SIGKILL'); } catch {}
  }
  if (child && !child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => handleTermination('SIGINT'));
process.on('SIGTERM', () => handleTermination('SIGTERM'));
process.on('SIGHUP', () => handleTermination('SIGHUP'));
