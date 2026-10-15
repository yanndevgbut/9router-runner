/**
 * 9Router Configuration Example
 * Salin file ini menjadi config.js jika ingin konfigurasi lewat file lokal.
 * Untuk Railway, lebih disarankan memakai menu Variables di Railway Dashboard!
 */

module.exports = {
  // Password login untuk Dashboard Web UI 9Router (Wajib diganti!)
  INITIAL_PASSWORD: "GantiDenganPasswordAman123!",

  // Mode Domain Tetap Cloudflare (Khusus jika ingin pakai Cloudflare Tunnel):
  // Di Railway, ini TIDAK diperlukan karena Railway otomatis menyediakan public domain HTTPS.
  USE_CUSTOM_DOMAIN: false,
  CUSTOM_DOMAIN: "",
  CLOUDFLARE_TUNNEL_TOKEN: "",

  // Aktifkan Cloudflare Tunnel (true / false)
  // Di Railway, default otomatis false (public URL ditangani Railway Edge).
  TUNNEL: false,

  // Auto-update 9Router saat server start (true / false)
  // Di Railway, default false agar proses deploy boot cepat.
  AUTO_UPDATE: false,
};
