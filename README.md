# Evolution WA Watchdog

Worker ringan untuk memantau semua instance WhatsApp di Evolution API dan mengirim alert Digichat secara private ke nomor owner masing-masing instance saat instance tersebut terputus.

## Kenapa polling, bukan webhook?

Webhook bagus untuk event pesan, tetapi status disconnect/reconnect instance tidak selalu dikirim konsisten ke aplikasi eksternal. Untuk kebutuhan monitoring semua WA, polling endpoint Evolution lebih reliable:

- `GET /instance/fetchInstances` untuk mengambil semua instance.
- `GET /instance/connectionState/{instance}` untuk cek status real tiap instance.
- `POST /message/sendText/{instance}` untuk kirim alert ke nomor owner.

## Fitur

- Node.js worker tanpa dependency berat.
- Cek semua instance Evolution API berkala.
- Alert Digichat saat status instance `disconnected` atau `unknown`.
- Private routing: alert instance A dikirim hanya ke nomor owner instance A dari `ownerJid`.
- Tidak ada broadcast/campur data antar instance/customer.
- Grace period: alert hanya dikirim jika instance terputus terus-menerus minimal 2 menit (`DISCONNECT_GRACE_SECONDS`), agar tidak sensitif ke gangguan sesaat.
- Disconnect alert dikirim 1x per episode; tidak diulang selama masih down.
- Notifikasi otomatis di-reset saat instance terhubung kembali, sehingga putus berikutnya dialert lagi.
- Data instance yang dihapus dari Evolution otomatis ikut terhapus dari state.
- Recovery alert default mati agar chat tidak ramai.
- State persistence via JSON volume `/app/data/state.json`.
- Health endpoint untuk Coolify: `/health` dan `/status`.
- Secret via ENV, tidak hardcode di repo.
- Unit test menggunakan Node built-in test runner.

## ENV Coolify

Copy dari `.env.example` dan isi di Coolify:

```env
EVOLUTION_BASE_URL=https://wa-api.taro.web.id
EVOLUTION_API_KEY=isi-di-env-private
ALERT_SENDER_INSTANCE=test-bot
ALERT_RECIPIENT_NUMBER=
POLL_INTERVAL_SECONDS=60
ALERT_COOLDOWN_SECONDS=900
DISCONNECT_GRACE_SECONDS=120
SEND_RECOVERY_ALERTS=false
SEND_STARTUP_SUMMARY=false
IGNORE_INSTANCES=
EXCLUDED_INSTANCES=test-bot
STATE_FILE=/app/data/state.json
PORT=8080
DRY_RUN=false
REQUEST_TIMEOUT_MS=15000
```

Catatan:

- `ALERT_SENDER_INSTANCE` adalah instance sehat yang dipakai untuk mengirim alert. Untuk project ini: `test-bot`.
- Alert tidak dikirim ke `ALERT_RECIPIENT_NUMBER`; mode private memakai `ownerJid` dari tiap instance (`628...@s.whatsapp.net`) lalu dikirim hanya ke nomor owner instance tersebut.
- `EXCLUDED_INSTANCES` wajib berisi sender seperti `test-bot` agar pengirim alert tidak ikut dimonitor.
- `IGNORE_INSTANCES` bisa diisi comma-separated untuk exclude tambahan, misalnya `wa-dev,wa-internal`.
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

## Cara kerja alert private

1. Worker fetch semua instance.
2. Worker membaca nomor owner dari `ownerJid` tiap instance.
3. Worker cek `connectionState` per instance.
4. Jika instance A terputus, worker mulai menghitung durasi disconnect. Alert *Digichat Alert* baru dikirim ke owner instance A setelah putus terus-menerus minimal `DISCONNECT_GRACE_SECONDS` (default 2 menit).
5. Jika instance B juga terputus, worker kirim pesan terpisah hanya ke owner instance B.
6. Jika masih down, worker tidak spam; alert dikirim sekali saja per episode disconnect.
7. Saat instance terhubung kembali, catatan alert-nya dihapus (reset), sehingga jika putus lagi nanti akan dialert ulang.
8. Instance yang dihapus dari Evolution otomatis dibersihkan dari state (data ikut terhapus).
9. Recovery alert default mati (`SEND_RECOVERY_ALERTS=false`) agar chat customer tidak ramai.

Privacy rule: tidak ada pesan yang berisi daftar semua instance/customer, dan tidak ada alert lintas-customer.

## Keamanan

- Jangan commit `.env`.
- Simpan `EVOLUTION_API_KEY` hanya di Coolify ENV.
- Rotate API key jika pernah dikirim melalui chat publik atau disimpan di tempat tidak aman.
