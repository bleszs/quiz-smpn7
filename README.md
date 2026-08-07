# Misi Simpang — Kuis Individu

Paket ini merupakan game statis mandiri. Website MedanSimpang utama tidak perlu diubah.

## Menjalankan secara lokal

Klik dua kali `index.html`, kemudian buka menggunakan Chrome, Edge, atau browser ponsel.

## Hosting

Unggah seluruh isi folder `quiz-individu` ke layanan hosting statis. Pastikan `index.html` dan folder `assets` berada pada tingkat folder yang sama.

Struktur yang harus dipertahankan:

```text
quiz-individu/
├── index.html
└── assets/
    ├── deli-riverview.jpg
    ├── jajanan-lokal.jpg
    ├── jembatan-rel.jpg
    ├── kampung-silalas.jpg
    ├── masjid-silalas.jpg
    └── rumah-qohwah.jpg
```

Setelah hosting selesai, bagikan URL `index.html` atau URL root hosting kepada siswa.

## Cara siswa mengumpulkan hasil

Setelah menyelesaikan kuis, siswa dapat:

- mengambil screenshot halaman hasil;
- menekan **Salin Hasil** lalu mengirimkan teksnya;
- menekan **Unduh Hasil** untuk mendapatkan file `.txt`; atau
- memilih **Simpan PDF**.

## Batasan versi statis

Nama dan hasil tidak dikirim ke server. Data hanya tersimpan pada browser masing-masing siswa. Karena itu, belum ada leaderboard bersama seperti layanan Quizizz asli. Leaderboard terpusat memerlukan database/backend dan konfigurasi hosting tambahan.

Urutan soal dan pilihan jawaban diacak untuk setiap pemain. Kuis tidak memiliki batas waktu.
