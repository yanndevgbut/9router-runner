/**
 * 9Router Configuration File
 *
 * Catatan untuk Railway:
 * - Variabel yang diset di Dashboard Railway (tab Variables) otomatis MENG-OVERRIDE isi file ini!
 * - Di Railway, Cloudflare TUNNEL otomatis dinonaktifkan karena Railway sudah menyediakan domain HTTPS bawaan.
 */

module.exports = {
  // Password login untuk Dashboard Web UI 9Router (Wajib diganti untuk remote access)
  INITIAL_PASSWORD: "PasswordAdmin123!",

  // Switch Domain Tetap:
  // Set ke TRUE  : Menggunakan domain tetap Anda (yannrouter.biz.id) dengan token
  // Set ke FALSE : Menggunakan domain acak gratis dari Cloudflare (trycloudflare.com)
  USE_CUSTOM_DOMAIN: true,

  // Nama domain tetap Anda (dipakai saat USE_CUSTOM_DOMAIN: true)
  CUSTOM_DOMAIN: "yannrouter.biz.id",

  // Token Tunnel Cloudflare dari Zero Trust (Wajib diisi jika USE_CUSTOM_DOMAIN: true)
  // Tempel token panjang yang berawalan eyJh... di bawah ini:
  CLOUDFLARE_TUNNEL_TOKEN: "",

  // Aktifkan Tunnel publik (true / false)
  TUNNEL: true,

  // Auto-update 9Router saat server start (true / false)
  AUTO_UPDATE: true,
};
