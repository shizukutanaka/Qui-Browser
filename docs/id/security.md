# Dasar Keamanan (Bahasa Indonesia)

## Model Ancaman

- **Permukaan server**: `server-lightweight.js` melayani REST API dan file
  statis.
- **Data yang tersimpan**: metadata ekstensi (`data/extensions.json`), sesi
  penjelajahan, dan buku langganan (`data/subscriptions.json`).
- **Data yang ditransmisikan**: lalu lintas klien VR dan webhook Stripe.

## Daftar Penguatan

- **Terminasi TLS**: operasikan di balik HTTPS menggunakan reverse proxy atau
  load balancer.
- **Validasi host**: atur `ALLOWED_HOSTS` di `.env`; `validateHostHeader()`
  menolak host tidak sah.
- **CORS ketat**: `parseAllowedOrigins()` menjaga daftar putih asal yang
  diperbolehkan.
- **Rate limiting**: `checkRateLimit()` dengan jendela geser mengurangi
  penyalahgunaan.
- **Pengiriman statis aman**: `serveStaticFile()` menormalkan path dan memeriksa
  tautan simbolik.
- **Kebijakan kompresi**: `utils/compression.js` membatasi MIME yang dikompresi
  untuk mengurangi risiko BREACH.

## Manajemen Kunci Stripe

- Simpan `STRIPE_SECRET_KEY` dan `STRIPE_WEBHOOK_SECRET` di pengelola rahasia.
- Rotasi kunci secara berkala dan perbarui variabel CI/CD.
- Hanya terima webhook melalui HTTPS dan awasi kegagalan verifikasi tanda
  tangan.

## Respons Insiden

1. Hentikan lalu lintas atau cabut kunci saat ada indikasi kompromi.
2. Tinjau log di `logs/` dan peristiwa pada dasbor Stripe.
3. Jika perlu, pulihkan dari `backups/` dan jalankan `npm test` untuk
   verifikasi.
4. Terapkan perbaikan, lakukan penyebaran ulang, informasikan pemangku
   kepentingan, dan dokumentasikan pelajaran yang didapat.

## Kepatuhan

- Dokumentasikan kebijakan retensi untuk riwayat VR dan data langganan.
- Simpan catatan persetujuan sesuai GDPR/CCPA bila relevan.
- Jalankan `npm run security:scan` di setiap integrasi dan arsipkan hasilnya.
