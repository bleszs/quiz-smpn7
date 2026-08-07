# Misi Simpang — Kuis Realtime

Kuis kelas bergaya Quizizz untuk materi MedanSimpang. Satu perangkat menjadi host, peserta bergabung dari perangkat masing-masing menggunakan kode room, dan leaderboard bersama ditampilkan setelah 10 soal selesai.

**Website:** [quiz-smpn7-production.up.railway.app](https://quiz-smpn7-production.up.railway.app)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fbleszs%2Fquiz-smpn7)

## Fitur

- room enam karakter yang mudah dibagikan;
- pendaftaran peserta menggunakan nama dan kelas;
- ruang tunggu dan daftar peserta realtime;
- 10 detik untuk setiap soal;
- skor berdasarkan ketepatan, kecepatan, dan streak;
- indikator jumlah peserta yang sudah menjawab pada layar host;
- feedback jawaban dan perpindahan soal otomatis;
- podium tiga besar serta peringkat seluruh peserta;
- pemulihan sesi saat koneksi browser terputus sesaat;
- tombol main lagi tanpa meminta peserta bergabung ulang.

## Menjalankan secara lokal

Persyaratan: Node.js 20 atau versi yang lebih baru.

```bash
npm install
npm start
```

Buka `http://localhost:3000`. Untuk mencoba dari ponsel pada jaringan Wi-Fi yang sama, buka alamat IP komputer pada port 3000, misalnya `http://192.168.1.10:3000`.

Jangan lagi membuka `index.html` dengan klik dua kali. Versi realtime membutuhkan server Node.js yang aktif.

## Cara bermain

1. Buka aplikasi pada perangkat host dan pilih **Buat room baru**.
2. Bagikan kode atau tautan room yang muncul.
3. Peserta memilih **Gabung sebagai peserta**, lalu mengisi kode, nama, dan kelas.
4. Setelah semua peserta terlihat di ruang tunggu, host menekan **Mulai kuis**.
5. Soal berganti otomatis setelah 10 detik dan jeda pembahasan singkat.
6. Leaderboard seluruh peserta tampil setelah soal terakhir.

## Pengujian

```bash
npm test
```

Tes otomatis membuat satu host dan beberapa peserta virtual, menjalankan seluruh 10 soal, dan memverifikasi leaderboard akhir.

## Hosting

Aplikasi membutuhkan hosting Node.js yang mendukung koneksi WebSocket persisten. Perintah produksinya adalah `npm start`; gunakan variabel lingkungan `PORT` bila disediakan oleh layanan hosting.

Untuk deployment gratis, klik tombol **Deploy to Render** di atas. Blueprint akan membuat satu Web Service Node di region Singapura, menjalankan health check `/health`, dan mengaktifkan deployment otomatis setiap ada commit baru pada branch utama.

Deployment statis atau membuka file HTML langsung tidak dapat menjalankan room realtime. Room saat ini disimpan di memori server dan otomatis dibersihkan setelah dua jam tidak aktif. Jika server dimulai ulang, room yang sedang berjalan ikut terhapus. Untuk penggunaan berskala besar atau beberapa instance server, penyimpanan room perlu dipindahkan ke Redis/database dan Socket.IO Redis adapter.

## Struktur

```text
quiz-individu/
├── assets/             # Foto soal
├── test/               # Tes alur realtime
├── client.js           # State dan interaksi browser
├── index.html          # Struktur UI
├── styles.css          # Sistem visual responsif
├── server.js           # Room, timer, scoring, dan Socket.IO
├── package.json
└── PRODUCT.md          # Konteks produk dan prinsip desain
```
