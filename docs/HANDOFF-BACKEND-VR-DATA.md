# Catatan Handoff — Data VR untuk Tim Backend

> Dibuat oleh tim VR (Aditya) sebagai bahan diskusi/porting untuk tim Backend
> (Azkal / Akmal). Dokumen ini **tidak mengubah kode backend** — hanya
> mencatat status data VR dan hal yang perlu disepakati. Referensi kontrak
> lengkap: [`API.md`](API.md).
>
> **Diperbarui 2026-10-27.** Handoff awal (Juli–Agustus 2026) sudah sebagian
> besar dikerjakan: data kalibrasi sudah di-seed ke backend `museum-ub.realitas.id`.
> Dokumen ini sekarang berisi **status terkini** dan **catatan yang masih terbuka**.

---

## 1. Status data VR di backend (dicek langsung ke API, 2026-10-27)

| Hal | Status |
|---|---|
| Daftar ruang publik (`GET /api/vr/scenes`) | 19 entri: `lobby`, `lobby-open` (frame animasi pintu), dan Ruang `1`–`17` |
| Foto 360° | Ada untuk semua ruang publik (URL absolut, Cloudinary) |
| `horizon_roll` | Ada di 18 dari 18 ruang publik, nilainya sama dengan data kalibrasi |
| `initial_yaw` | Sama dengan data kalibrasi di 16 dari 18 ruang. Beda: Lobby (backend `-88`, seed `-90`) dan Ruang 3 (backend `-86.32`, seed `-83`) |
| Hotspot navigasi | 46 dari 50 sama persis dengan seed (yaw, pitch, tujuan). Yang beda ada di Lobby dan Ruang 3 |
| Hotspot info | Sudah ada di Ruang 2, 3, 4, dan 7–15 (74 hotspot, semuanya punya `collection_id`) |
| Field tambahan (`variant`, `arrow_deg`, `transition_url`) | Sudah dikirim pada semua 50 hotspot navigasi. `transition_url` hanya terisi di pintu Lobby |
| Ruang restricted | `GET /api/vr/scenes/restricted-*` tanpa token membalas `401` (dicek `restricted-18` dan `restricted-26`) |
| `GET /api/vr/collections/{id}` | Berjalan (200) dan memakai nama field kontrak: `name`, `latin_name`, `category`, `description`, `photos`, `audio_url`, `video_url`, `portal_url` |

Nilai di backend yang dipakai tur live. Salinan di sisi frontend ada di
[`lib/calibrationSeed.ts`](../lib/calibrationSeed.ts) (dipakai juga oleh tool
`/dev/calibrate`). Kalau ada kalibrasi ulang di salah satu sisi, samakan
keduanya.

---

## 2. Yang sudah tidak berlaku dari handoff awal

- **Konversi yaw saat porting** (`YAW_CORRECTION_DEG`, pengurangan `initial_yaw`):
  sudah dihapus dari kode. `yaw`/`pitch` di seed dan di backend adalah
  world-space dan dipakai apa adanya oleh frontend.
- **Tabel data kalibrasi per ruang** yang dulu ada di dokumen ini sudah usang
  (angka dan jumlah ruangnya tidak lagi sama). Sumber yang benar adalah
  `lib/calibrationSeed.ts` dan ekspor JSON dari `/dev/calibrate`.
- **Perbedaan "mock lokal vs seed backend"**: backend sudah berisi data ruang
  asli, jadi dua sumber itu tidak lagi terpisah. Mode preview lokal
  (`NEXT_PUBLIC_LOCAL_PREVIEW=true`) hanya untuk pengembangan.
- **Penambahan kolom** `horizon_roll`, `variant`, `arrow_deg`, `transition_url`:
  sudah diimplementasikan backend (lihat bagian 1).
- **Keamanan ruang restricted**: backend sudah mewajibkan token Sanctum untuk
  ruang restricted (lihat bagian 1).

---

## 3. Catatan yang masih terbuka untuk Backend

1. **`thumbnail_url` sama dengan `panorama_url`** di 18 dari 18 ruang. Galeri
   "All Location" dan Denah akhirnya memuat foto 360° penuh (beberapa MB per
   ruang). Mohon sediakan thumbnail kecil yang sudah dioptimasi.
2. **Judul ruang tidak unik**: `Lobby` dipakai oleh Lobby, Ruang 1, dan Ruang 2;
   `Instrumenta` oleh Ruang 7, 8, dan 11; `Vital` oleh Ruang 9 dan 10. Di galeri
   dan Denah, ruang berbeda bisa tampil dengan nama yang sama.
3. **Posisi di Denah**: `map_x`/`map_y` hanya terisi untuk Lobby. Ruang lain
   belum punya pin di Denah.
4. **Ruang 5 dan 6 tidak punya hotspot sama sekali** (di backend maupun seed),
   jadi pengunjung yang masuk ke sana tidak bisa pindah ruang lewat hotspot.
5. **Audio dan link portal koleksi**: pada tiga koleksi contoh yang dicek,
   `audio_url` kosong dan `portal_url` kosong, sehingga voice-over dan tombol
   "Selengkapnya di Web Portal" belum muncul untuk koleksi tersebut.
6. **Penamaan ruang belum seragam**: sebagian ruang memakai nama zona
   (History, Muskuloskeletal, Instrumenta, Vital, Respirasi, Kardiovaskular,
   Reproduksi, Echo), sedangkan Ruang 5, 6, 16, dan 17 masih "Ruang N". Perlu
   disepakati penamaan akhirnya (terkait poin 2).

---

## 4. Yang ditangani di sisi frontend

- Hotspot info tanpa `collection_id` disembunyikan, dan label bawaan
  "Hotspot N" tidak ditampilkan (`presentableHotspots` di
  [`components/vr/VRScene.tsx`](../components/vr/VRScene.tsx)). Begitu data
  lengkap, keduanya muncul otomatis tanpa perubahan kode.
- Tipe hotspot `photo` dan `external_link` sudah didukung frontend. Pada data
  yang dicek, backend belum mengirim hotspot bertipe itu.
