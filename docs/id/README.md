# Ikhtisar Qui Browser (Bahasa Indonesia)

## Visi Produk

Qui Browser adalah pengalaman web ringan yang difokuskan untuk VR, mendukung
ekstensi Chrome, mengoptimalkan streaming video, dan menerapkan kontrol
langganan berbasis Stripe.

## Kemampuan Utama

- **Kompatibilitas ekstensi**: API `/api/extensions` untuk memasang,
  memperbarui, dan menghapus ekstensi yang kompatibel dengan Chrome.
- **Pipa media**: `utils/media-pipeline.js` menangani permintaan rentang agar
  pemutaran VR tetap mulus.
- **Kontrol langganan**: `server-lightweight.js` memeriksa status Stripe sebelum
  memberikan fitur premium.

## Mulai Cepat

1. Instal dependensi: `npm install`
2. Salin `.env.example` ke `.env` dan isi kunci Stripe.
3. Jalankan server ringan: `npm start`
4. Buka antarmuka VR di headset atau emulator.

## Panduan Direktori

- `server-lightweight.js`: server HTTP inti dan logika routing.
- `utils/stripe-service.js`: integrasi Stripe Checkout dan webhook.
- `extensions/manager.js`: manajemen persisten ekstensi yang terpasang.
- `docs/`: kumpulan dokumentasi multibahasa.

## Dukungan & Masukan

Catat isu atau usulan melalui pelacak proyek dan sesuaikan dengan roadmap
berfokus VR.
