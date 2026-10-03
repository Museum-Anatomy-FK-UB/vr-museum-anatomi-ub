# Naskah Voice Over — Panduan Mode VR

Panduan ini muncul otomatis saat pengunjung masuk Mode VR di **Main Location** (sekali per kunjungan), dan bisa dibuka lagi dari menu VR → **Panduan**. Ada dua jalur: **Mode Controller** dan **Mode Tangan**; langkah 1–2 sama untuk keduanya.

## Cara menyerahkan rekaman

- Satu file per langkah, **format MP3** (mono, 44.1 kHz, 96–128 kbps sudah cukup).
- Beri nama file **persis** seperti kolom *Nama file* di bawah, lalu letakkan di `public/audio/guide/` (atau kirimkan ke developer).
- Bicara tenang dan jelas, jeda ±0,5 detik di awal & akhir. Durasi ideal 10–25 detik per langkah.
- Sebelum file ada, panduan tetap berjalan dengan teks saja.

Teks di panel VR sengaja lebih singkat dari naskah suara. Naskah dan teks panel disimpan di `lib/vrGuide.ts` — ubah di sana bila ada revisi.

## Daftar rekaman (12 file)

| No | Nama file | Jalur | Judul |
|---|---|---|---|
| 1 | `01-intro.mp3` | Keduanya | Selamat datang di Virtual Museum Anatomi |
| 2 | `02-look.mp3` | Keduanya | Melihat sekeliling |
| 3 | `controller-03-select.mp3` | Controller | Membidik dan memilih |
| 4 | `controller-04-move.mp3` | Controller | Berpindah ruangan |
| 5 | `controller-05-info.mp3` | Controller | Informasi koleksi |
| 6 | `controller-06-menu.mp3` | Controller | Membuka menu |
| 7 | `controller-07-finish.mp3` | Controller | Siap menjelajah! |
| 8 | `hand-03-select.mp3` | Tangan | Membidik dan memilih |
| 9 | `hand-04-move.mp3` | Tangan | Berpindah ruangan |
| 10 | `hand-05-info.mp3` | Tangan | Informasi koleksi & sentuh langsung |
| 11 | `hand-06-menu.mp3` | Tangan | Membuka menu |
| 12 | `hand-07-finish.mp3` | Tangan | Siap menjelajah! |

## Naskah

### 1. Selamat datang di Virtual Museum Anatomi — Keduanya

**File:** `01-intro.mp3`

> Selamat datang di Virtual Museum Anatomi Fakultas Kedokteran Universitas Brawijaya. Sebelum mulai menjelajah, ikuti panduan singkat ini untuk mengenal cara menggunakan mode VR. Pilih tombol Berikutnya untuk melanjutkan, atau pilih Lewati jika Anda sudah terbiasa.

*Teks di panel:* Panduan singkat ini menjelaskan cara menjelajah museum dalam mode VR. Pilih Berikutnya untuk lanjut, atau Lewati jika Anda sudah terbiasa.

### 2. Melihat sekeliling — Keduanya

**File:** `02-look.mp3`

> Untuk melihat sekeliling, cukup putar kepala atau badan Anda ke arah mana pun. Anda dapat melihat seluruh ruangan tiga ratus enam puluh derajat tanpa perlu menekan tombol apa pun.

*Teks di panel:* Cukup putar kepala atau badan Anda untuk melihat seluruh ruangan 360°. Tidak perlu menekan apa pun.

### 3. Membidik dan memilih — Mode Controller

**File:** `controller-03-select.mp3`

> Sinar laser keluar dari ujung setiap controller. Arahkan laser ke objek yang ingin Anda pilih, lalu tekan tombol trigger, yaitu tombol di bawah jari telunjuk Anda. Objek yang sedang dibidik akan sedikit membesar, dan lasernya berubah menjadi kuning.

*Teks di panel:* Arahkan laser dari controller ke sebuah objek, lalu tekan trigger — tombol di bawah jari telunjuk. Objek yang dibidik akan membesar dan lasernya berubah kuning.

### 4. Berpindah ruangan — Mode Controller

**File:** `controller-04-move.mp3`

> Ikon panah yang ada di lantai adalah jalan menuju ruangan berikutnya. Bidik panah tersebut dengan laser, lalu tekan trigger. Anda akan berpindah ke ruangan baru, dan pandangan Anda langsung menghadap ke arah yang tepat.

*Teks di panel:* Ikon panah di lantai membawa Anda ke ruangan berikutnya. Bidik panahnya, lalu tekan trigger. Pandangan Anda langsung menghadap ke arah yang tepat.

### 5. Informasi koleksi — Mode Controller

**File:** `controller-05-info.mp3`

> Ikon bertanda huruf i menyimpan informasi tentang koleksi anatomi, berupa foto, penjelasan, dan rekaman suara. Bidik ikon tersebut, lalu tekan trigger untuk membuka panelnya. Setelah selesai, pilih tombol Tutup.

*Teks di panel:* Ikon (i) berisi informasi koleksi: foto, penjelasan, dan suara. Bidik ikonnya dan tekan trigger untuk membuka panel, lalu pilih Tutup untuk menutupnya.

### 6. Membuka menu — Mode Controller

**File:** `controller-06-menu.mp3`

> Untuk membuka menu, tekan tombol B atau tombol Y pada controller. Anda juga dapat membidik tombol Menu yang melayang di atas controller kiri. Dari menu ini Anda bisa kembali ke lokasi utama, melihat semua lokasi, membuka denah museum, menyembunyikan atau menampilkan hotspot, membuka panduan ini kembali, atau keluar dari mode VR.

*Teks di panel:* Tekan tombol B atau Y untuk membuka menu, atau bidik tombol Menu di atas controller kiri. Isi menu: Main Location, All Location, Denah, Hotspot, Panduan, dan Keluar VR.

### 7. Siap menjelajah! — Mode Controller

**File:** `controller-07-finish.mp3`

> Untuk keluar dari mode VR, pilih Keluar VR pada menu, atau tekan tombol Meta pada controller kanan. Panduan ini dapat dibuka kembali kapan saja melalui menu Panduan. Selamat menjelajahi Museum Anatomi Fakultas Kedokteran Universitas Brawijaya!

*Teks di panel:* Untuk keluar, pilih Keluar VR di menu atau tekan tombol Meta pada controller kanan. Panduan ini bisa dibuka lagi dari menu Panduan. Selamat menjelajah!

### 8. Membidik dan memilih — Mode Tangan

**File:** `hand-03-select.mp3`

> Saat menggunakan tangan, sinar laser keluar dari tangan Anda. Arahkan laser ke objek yang ingin Anda pilih, lalu lakukan gerakan mencubit, yaitu mempertemukan ujung ibu jari dengan ujung jari telunjuk. Objek yang sedang dibidik akan sedikit membesar, dan lasernya berubah menjadi kuning.

*Teks di panel:* Laser keluar dari tangan Anda. Arahkan ke sebuah objek, lalu cubit — pertemukan ujung ibu jari dan jari telunjuk — untuk memilih.

### 9. Berpindah ruangan — Mode Tangan

**File:** `hand-04-move.mp3`

> Ikon panah yang ada di lantai adalah jalan menuju ruangan berikutnya. Arahkan laser ke panah tersebut, lalu lakukan gerakan mencubit. Anda akan berpindah ke ruangan baru, dan pandangan Anda langsung menghadap ke arah yang tepat.

*Teks di panel:* Ikon panah di lantai membawa Anda ke ruangan berikutnya. Arahkan laser ke panahnya, lalu cubit. Pandangan Anda langsung menghadap ke arah yang tepat.

### 10. Informasi koleksi & sentuh langsung — Mode Tangan

**File:** `hand-05-info.mp3`

> Ikon bertanda huruf i menyimpan informasi tentang koleksi anatomi. Arahkan laser ke ikon tersebut lalu cubit untuk membuka panelnya. Saat menggunakan tangan, panel akan muncul dekat dengan Anda, dan tombol-tombolnya bisa langsung Anda sentuh dengan ujung jari telunjuk, seperti menekan tombol sungguhan.

*Teks di panel:* Cubit ikon (i) untuk membuka informasi koleksi. Panel muncul dekat Anda, dan tombolnya bisa langsung disentuh dengan ujung jari telunjuk — seperti menekan tombol sungguhan.

### 11. Membuka menu — Mode Tangan

**File:** `hand-06-menu.mp3`

> Untuk membuka menu, angkat tangan kiri Anda. Tombol Menu akan melayang di atas tangan kiri. Sentuh tombol tersebut dengan ujung jari telunjuk kanan. Dari menu ini Anda bisa kembali ke lokasi utama, melihat semua lokasi, membuka denah museum, menyembunyikan atau menampilkan hotspot, membuka panduan ini kembali, atau keluar dari mode VR.

*Teks di panel:* Angkat tangan kiri: tombol Menu muncul di atasnya. Sentuh tombol itu dengan telunjuk kanan. Isi menu: Main Location, All Location, Denah, Hotspot, Panduan, dan Keluar VR.

### 12. Siap menjelajah! — Mode Tangan

**File:** `hand-07-finish.mp3`

> Untuk keluar dari mode VR, pilih Keluar VR pada menu, atau hadapkan telapak tangan ke wajah lalu cubit ikon Meta yang muncul. Panduan ini dapat dibuka kembali kapan saja melalui menu Panduan. Selamat menjelajahi Museum Anatomi Fakultas Kedokteran Universitas Brawijaya!

*Teks di panel:* Untuk keluar, pilih Keluar VR di menu, atau hadapkan telapak tangan ke wajah lalu cubit ikon Meta. Panduan ini bisa dibuka lagi dari menu Panduan. Selamat menjelajah!
