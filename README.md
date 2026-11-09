# SATU DATA UMB — KPI Checklist + Repositori QS AUR · THE SIR · UIGM

PWA offline-first. Frontend: GitHub Pages. Backend: Google Apps Script + Google Sheets.

## Isi repo GitHub (publik/privat sesuai pilihan Anda)
`index.html, app.js, feat.js, style.css, sw.js, manifest.webmanifest, config.js, seed-data.js, icons/, vendor/`
**Jangan unggah `Code.gs` dan file daftar akun ke GitHub.** `Code.gs` hanya untuk ditempel di Apps Script.

## Pemasangan
1. Google Sheet kosong → Ekstensi → Apps Script → tempel seluruh `Code.gs` → Simpan.
2. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone) → salin URL `/exec` ke `config.js` (`API_URL`).
3. Unggah isi repo ke GitHub → Settings → Pages.
4. Buka aplikasi, login sebagai `andiazhar` dengan kata sandi dari file akun. Server otomatis terisi pada login pertama (tanpa Setup Key).
5. Bila server sudah pernah diinisialisasi dengan versi lama: di editor Apps Script jalankan fungsi `resetSemua()` sekali, lalu login ulang.

## Akun
Super admin: Andi Azhar. Lainnya: admin. Rektor/Wakil Rektor tidak punya akun. Nama pengguna = nama tanpa gelar, huruf kecil disambung. Kata sandi diubah sendiri via Lainnya → Ubah kata sandi; super admin dapat mereset via Admin.
Aturan mutu: pengisi indikator tidak dapat memvalid/finalkan indikatornya sendiri (kecuali super admin).

## Fitur utama
- **UIGM 2026**: 118 butir kuesioner resmi sebagai formulir (pilihan jawaban, tabel isian, uraian, tautan bukti), perhitungan otomatis rumus UIGM, skor perkiraan.
- **PDF berlogo UMB**: satu PDF per indikator UIGM mengikuti templat bukti resmi (University/Country/Web terisi otomatis), paket per kategori, rekap QS/THE/UIGM, Data Inti. Menu Lainnya → Unduh PDF.
- **Cari**: pencarian lintas Data Inti, indikator, bukti, permintaan, tugas (sinonim dosen/faculty, dll.).
