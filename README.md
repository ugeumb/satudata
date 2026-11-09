# SATU DATA UMB — KPI Checklist + Repository QS AUR · THE SIR · UIGM

PWA (HTML/JS murni, offline-first). Frontend: GitHub Pages. Backend: Google Apps Script + Google Sheets. Tanpa biaya server.

## Isi paket
- `index.html, app.js, style.css, sw.js, manifest.webmanifest, icons/` — aplikasi
- `seed-data.js` — data awal (user, tugas, 49 indikator QS, 212 THE, 60 placeholder UIGM, Data Inti, kalender, risiko)
- `config.js` — isi `API_URL` setelah backend terpasang
- `Code.gs` — backend Apps Script
- `seed.js`, `the.json` — generator seed (opsional, tidak dipakai saat runtime)

## Pemasangan (±20 menit)

### 1. Backend
1. Buat Google Sheet kosong, mis. "SATU DATA UMB".
2. Menu **Ekstensi → Apps Script**, hapus isi default, tempel seluruh `Code.gs`, simpan.
3. **Project Settings → Script properties**, tambahkan `SETUP_KEY` = kata sandi acak panjang (mis. 20 karakter). Opsional: `FOLDER_ID` (folder Drive untuk unggahan bukti).
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Izinkan otorisasi, salin URL berakhiran `/exec`.

### 2. Frontend
1. Buka `config.js`, isi `API_URL:'URL /exec tadi'`.
2. Unggah seluruh folder ke repo GitHub, aktifkan **Settings → Pages** (branch main, root). HTTPS wajib agar PWA dapat dipasang.

### 3. Inisialisasi (sekali)
1. Buka aplikasi → layar login → **Pengaturan server** → **Inisialisasi server**, masukkan `SETUP_KEY`.
2. Server membuat semua user dan **menampilkan PIN acak 6 digit satu kali**. Catat dan bagikan tiap PIN lewat jalur pribadi. PIN tidak dapat dilihat lagi; admin hanya dapat mereset.
3. Login sebagai admin, **Admin → Impor CSV indikator** untuk mengganti 60 placeholder UIGM dengan butir resmi.

## Memasang di HP
- **Android (Chrome):** buka URL, ketuk tombol **Pasang aplikasi** atau menu ⋮ → *Install app / Add to Home screen*.
- **iPhone (wajib Safari):** buka URL, ketuk **Bagikan → Tambah ke Layar Utama**. Chrome/Firefox di iOS tidak bisa memasang PWA.

## Cara kerja singkat
- Data tersimpan lokal dulu, lalu disinkronkan (antrean offline, pull inkremental tiap 60 dtk, tombol status di atas untuk sinkron manual).
- Alur indikator: kosong → draft → dicek → valid → final. Valid hanya oleh pemeriksa/koordinator; final hanya koordinator/admin. Nilai valid harus sama dengan Data Inti dan, bila diwajibkan, memiliki bukti.
- Peran: admin, koordinator, anggota, pengarah (hanya baca).

## Catatan keamanan dan batasan
- Otorisasi ditegakkan di server (`allowed()` di Code.gs); pengecekan di klien hanya untuk UX.
- Autentikasi PIN 6 digit + token HMAC 14 hari + kunci 8 kali gagal/15 menit. Ini ringan; jangan simpan data yang sangat sensitif (mis. data pribadi mahasiswa/dosen) di sini.
- Kuota Apps Script gratis terbatas (eksekusi/hari dan ukuran respons); cukup untuk tim ±16 orang, tidak untuk lalu lintas besar.
- Unggahan bukti maks 8 MB per berkas; bila pembagian domain ditolak, berkas dibagikan "siapa pun dengan tautan" sebagai cadangan. Untuk berkas sensitif gunakan tautan Drive biasa.
- Setiap kali mengubah `Code.gs`, buat **New deployment version**, lalu perbarui cache klien (naikkan `u1d-v1` di `sw.js`).
- Cadangkan rutin lewat **Admin → Ekspor JSON/CSV**.
