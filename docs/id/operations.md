# Panduan Operasi Qui Browser (Bahasa Indonesia)

## Sasaran Pembaca

Tim operasi dan SRE yang bertanggung jawab untuk menerapkan dan memelihara Qui
Browser di lingkungan VR produksi.

## 1. Daftar periksa sebelum deployment

- **Citra kontainer**: Jalankan `docker build -t <registry>/qui-browser:<tag> .`
  dan `npm run security:scan` untuk pemeriksaan keamanan.
- **Berkas lingkungan**: Salin `.env.example`, hapus placeholder (`your_*`,
  `changeme`), simpan rahasia dalam pengelola rahasia.
- **Sertifikat TLS**: Siapkan untuk ingress/proxy terbalik sesuai catatan di
  `k8s/ingress.yaml`.
- **Konfigurasi penagihan**: Validasi kunci Stripe dan URL dengan
  `node ./cli.js billing:diagnostics`.
- **Aset statis**: Jalankan `npm run format:check` agar berkas terkompresi tetap
  sinkron.

## 2. Ekspektasi runtime

- **Entry point**: `server-lightweight.js` melalui `npm start` atau
  `node ./cli.js start --port 8000`.
- **Port default**: HTTP `8000`; WebSocket (`server-websocket.js`) memakai
  `8080` saat aktif.
- **Model penskalaan**: Layanan HTTP stateless; status sesi disimpan pada JSON
  `data/`. Gunakan storage bersama saat klaster.

## 3. Variabel lingkungan penting

| Variabel                 | Fungsi                        | Rekomendasi                                                   |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `PORT`                   | Port layanan                  | Selaraskan dengan `k8s/service.yaml`.                         |
| `HOST`                   | Alamat bind                   | `0.0.0.0` di dalam kontainer.                                 |
| `ALLOWED_HOSTS`          | Daftar host yang diizinkan    | Batasi pada domain ingress; dukung wildcard (`.example.com`). |
| `TRUST_PROXY`            | Terima header `X-Forwarded-*` | Setel `true` di belakang proxy.                               |
| `STATIC_ROOT`            | Root aset statis              | Default `.`; mount CDN bila perlu.                            |
| `LIGHTWEIGHT`            | Mode ringan                   | `true` untuk perangkat terbatas.                              |
| `BILLING_ADMIN_TOKEN`    | Token admin                   | ≥ 16 karakter, rotasi per kuartal.                            |
| `STRIPE_*`               | Kredensial Stripe             | Simpan di secrets manager.                                    |
| `DEFAULT_BILLING_LOCALE` | Locale harga default          | Cocokkan dengan `config/pricing.js`.                          |
| `LOG_LEVEL`              | Granularitas log mendatang    | Rencanakan integrasi logging terpusat.                        |
| `HEALTH_*`               | Ambang monitor kesehatan      | Sesuaikan dengan perangkat keras.                             |

> Catatan: jalankan `node ./cli.js billing:diagnostics` dan
> `node scripts/check-vulnerabilities.js` di pipeline CI sebelum rilis.

## 4. Workflow deployment

### Docker Compose

```bash
cp .env.example .env
# Sesuaikan variabel
npm install
npm run build
# Mulai server ringan
npm start
```

### Kubernetes

1. Push citra kontainer ke registry.
2. Perbarui tag dan request resource di `k8s/deployment.yaml`.
3. Terapkan manifold: `kubectl apply -f k8s/`.
4. Pantau rollout: `kubectl rollout status deployment/qui-browser`.
5. Pastikan layanan aktif: `kubectl get svc qui-browser`.

### Pembaruan gradual

- Setel citra baru:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Pantau kesehatan: `kubectl get pods`, `kubectl logs -l app=qui-browser`.
- Rollback bila perlu: `kubectl rollout undo deployment/qui-browser`.

## 5. Observabilitas

- **Endpoint kesehatan**: `GET /health` menyediakan status, uptime, penggunaan
  sumber daya, hitungan rate limiting (`server-lightweight.js`).
- **Endpoint metrik**: `GET /metrics` menampilkan data agregat; integrasikan
  dengan `ServiceMonitor` Prometheus (`k8s/servicemonitor.yaml`).
- **Log**: Tersimpan di `logs/`; gunakan driver eksternal atau skrip backup.
- **Dashboard**: `GET /dashboard` menghasilkan tampilan HTML melalui
  `utils/performance-dashboard.js`.

## 6. Pemeliharaan rutin

- **Backup**: Skrip pada `scripts/` (`list-backups`, `verify-backup`,
  `prune-backups`).
- **Uji pemulihan**: Jalankan `node scripts/restore-backup.js --id <timestamp>`
  di staging.
- **Keamanan**: Setiap rilis jalankan `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js`.
- **Kinerja**: `node scripts/benchmark.js --full` untuk baseline.

## 7. Respons insiden

1. Temukan degradasi (`/health` tidak `healthy`).
2. Isolasi pod bermasalah (`kubectl cordon`, skala turun bila perlu).
3. Kumpulkan log dan event (`kubectl describe pod`).
4. Pulihkan dari `backups/` bila data rusak.
5. Komunikasikan hasil dan catat tindak lanjut di `docs/improvement-backlog.md`.

## 8. Penguatan keamanan

- Wajibkan HTTPS via ingress, aktifkan HSTS di konfigurasi `security`.
- Batasi asal dengan `CORS_ALLOWED_ORIGINS`.
- Jaga konfigurasi `RATE_LIMIT_MAX` dan `RATE_LIMIT_WINDOW`.
- Siapkan alert Prometheus (CPU > 70%, RAM > 80%, lonjakan rate limiting).
- Pastikan pipeline CI menjalankan `npm run build` dan seluruh pengujian.

## 9. Troubleshooting

| Gejala               | Pemeriksaan                                  | Solusi                                        |
| -------------------- | -------------------------------------------- | --------------------------------------------- |
| 400 Host ditolak     | Periksa `ALLOWED_HOSTS`                      | Tambah domain ingress / wildcard.             |
| 503 kesehatan turun  | Analisa respon `/health`                     | Tambah resource atau sesuaikan `HEALTH_*`.    |
| Stripe gagal         | Jalankan `cli.js billing:diagnostics`        | Perbaiki kredensial, deploy ulang.            |
| Aset hilang          | Periksa `STATIC_ROOT`, log `serveStaticFile` | Sinkronkan aset atau perbaiki volume.         |
| Rate limiting tinggi | Lihat `/metrics`                             | Tingkatkan `RATE_LIMIT_MAX` atau gunakan CDN. |

## 10. Manajemen perubahan

- Catat perubahan dengan ID dari `docs/improvement-backlog.md`.
- Manfaatkan strategi blue/green atau canary (`maxUnavailable=0`, `maxSurge=1`).
- Simpan snapshot metrik untuk dilampirkan pada catatan rilis.

Selalu perbarui panduan ini bersamaan dengan perubahan konfigurasi atau
infrastruktur agar seluruh tim tetap sinkron.
