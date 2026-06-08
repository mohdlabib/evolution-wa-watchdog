# Evolution WA Watchdog

Worker ringan untuk memantau semua instance WhatsApp di Evolution API dan mengirim alert WhatsApp saat ada instance terputus.

## Kenapa polling, bukan webhook?

Webhook bagus untuk event pesan, tetapi status disconnect/reconnect instance tidak selalu dikirim konsisten ke aplikasi eksternal. Untuk kebutuhan monitoring semua WA, polling endpoint Evolution lebih reliable:

- `GET /instance/fetchInstances` untuk mengambil semua instance.
- `GET /instance/connectionState/{instance}` untuk cek status real tiap instance.
- `POST /message/sendText/{instance}` untuk kirim alert ke nomor owner.

## Fitur

- Node.js worker tanpa dependency berat.
- Cek semua instance Evolution API berkala.
- Alert WhatsApp saat status instance `disconnected` atau `unknown`.
- Anti-spam cooldown per instance.
- Recovery alert saat instance connect lagi.
- State persistence via JSON volume `/app/data/state.json`.
- Health endpoint untuk Coolify: `/health` dan `/status`.
- Secret via ENV, tidak hardcode di repo.
- Unit test menggunakan Node built-in test runner.

## ENV Coolify

Copy dari `.env.example` dan isi di Coolify:

```env
EVOLUTION_BASE_URL=https://wa-api.taro.web.id
EVOLUTION_API_KEY=isi-di-coolify
ALERT_SENDER_INSTANCE=test-bot
ALERT_RECIPIENT_NUMBER=083185730662
POLL_INTERVAL_SECONDS=60
ALERT_COOLDOWN_SECONDS=900
SEND_RECOVERY_ALERTS=true
SEND_STARTUP_SUMMARY=false
IGNORE_INSTANCES=
STATE_FILE=/app/data/state.json
PORT=8080
DRY_RUN=false
REQUEST_TIMEOUT_MS=15000
```

Catatan:

- `ALERT_SENDER_INSTANCE` adalah instance yang dipakai untuk mengirim alert. Untuk project ini: `test-bot`.
- `ALERT_RECIPIENT_NUMBER` bisa pakai format lokal `083...`; worker otomatis ubah ke `628...`.
- `IGNORE_INSTANCES` bisa diisi comma-separated, misalnya `test-bot,wa-dev` kalau tidak mau dipantau.
- Untuk percobaan aman, set `DRY_RUN=true` dulu.

## Jalankan lokal

```bash
cp .env.example .env
npm install
npm test
npm start
```

Health check:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/status
```

## Deploy Coolify

1. Buat project baru di Coolify.
2. Pilih repository ini.
3. Build pack: Dockerfile.
4. Set ENV dari `.env.example`.
5. Tambahkan persistent volume:
   - Host/Volume: bebas
   - Mount path: `/app/data`
6. Set health check path: `/health`.
7. Deploy.

## Cara kerja alert

1. Worker fetch semua instance.
2. Worker cek `connectionState` per instance.
3. Jika status berubah dari connected/baru menjadi disconnected/unknown, worker kirim alert.
4. Jika masih down, worker tidak spam; hanya kirim ulang setelah cooldown.
5. Jika reconnect, worker kirim recovery alert jika `SEND_RECOVERY_ALERTS=true`.

## Keamanan

- Jangan commit `.env`.
- Simpan `EVOLUTION_API_KEY` hanya di Coolify ENV.
- Rotate API key jika pernah dikirim melalui chat publik atau disimpan di tempat tidak aman.
