# Catatan Handoff — Data VR untuk Tim Backend

> Dibuat oleh tim VR (Aditya) sebagai bahan diskusi/porting untuk tim Backend
> (Azkal / Akmal). Dokumen ini **tidak mengubah kode backend** — hanya
> mengekspor data hasil kalibrasi dari sisi FE dan mencatat hal yang perlu
> disepakati. Referensi kontrak lengkap: [`API.md`](API.md).

---

## 1. Ada DUA sumber data VR, dan keduanya belum sinkron

| | Mock lokal FE | Seed Backend |
|---|---|---|
| File | [`lib/localPreviewData.ts`](../lib/localPreviewData.ts) | `database/seeders/VrMockSeeder.php` |
| Aktif saat | `NEXT_PUBLIC_LOCAL_PREVIEW=true` | API live (default) |
| Jumlah ruang | **18** (lobby + Ruang 1–17) | **4** (`ruang-lobby`, `pos-1..3`) |
| Slug | `lobby`, `1`..`17` | `ruang-lobby`, `pos-1`, `pos-2`, `pos-3` |
| Foto 360° | Foto museum **asli** (`public/panorama/`) | Gambar demo **Cloudinary** |
| Posisi hotspot | **Dikalibrasi** ke foto asli (`/dev/calibrate`, 2026-08-06) | Angka bulat tebakan untuk foto demo |
| `initial_yaw` | Hasil kalibrasi per ruang | Semua `0` |
| `horizon_roll` | Ada per ruang | **Belum ada** (kolom pun belum dibuat) |
| Koleksi (info) | Placeholder kosong | Data asli (skull/femur/heart) |

**Kesimpulan:** mock lokal = versi akurat untuk demo di foto asli; seed backend =
demo 4 ruang di foto placeholder. Saat foto final museum siap, data kalibrasi di
bawah perlu diporting ke seeder backend.

---

## 2. ⚠️ Jebakan konversi yaw saat porting

Nilai `yaw` di mock **bukan** angka mentah dari `/dev/calibrate`. Sebelum dipakai,
dilewatkan transformasi di `localPreviewData.ts`:

```
textureYaw = normalize(capturedYaw - 90)      // YAW_CORRECTION_DEG
worldYaw   = normalize(textureYaw - initial_yaw)
```

Backend menyajikan `yaw` **apa adanya** (dipakai langsung oleh `toPosition()` di
FE). Jadi yang harus disimpan ke DB adalah nilai **`yaw` (world-space) hasil
akhir** di tabel Bagian 4 — **bukan** angka `CAPTURED` mentah. Kalau salah,
hotspot bergeser ~90° + sebesar `initial_yaw` tiap ruang.

`pitch` tidak ditransformasi — pakai apa adanya.

---

## 3. Satu ruang boleh punya banyak hotspot? YA — sudah didukung

- FE: `Scene.hotspots` adalah array; `HotspotLayer` me-render semuanya tanpa batas.
- Backend: relasi `vr_rooms` → `vr_hotspots` one-to-many (`vr_room_id`).
- Sudah terbukti: `ruang-lobby` di seeder punya 3 hotspot navigasi sekaligus;
  Ruang 3 di mock punya 4 hotspot.
- Menambah hotspot (mis. pos-1 → pos-2, pos-3, pos-4) = **cukup tambah baris**,
  tanpa ubah skema DB atau kode FE.
- Yang perlu diperhatikan: `id` unik per ruang, jangan taruh 2 hotspot di
  yaw/pitch yang terlalu dekat (visualnya tumpang tindih), dan `target_room_id` /
  `target_item_id` harus valid.

---

## 4. Data kalibrasi final (world-space) — siap masuk seeder

`target` untuk navigasi = slug ruang tujuan; untuk info = id koleksi (masih
placeholder, menunggu data asli FK). Nilai `yaw` di sini sudah world-space
(lihat Bagian 2).

### Lobby  (slug: `lobby`) — initial_yaw = -90, horizon_roll = 1.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Masuk | navigation | 0 | -1 | up | 1 |

### Ruang 1  (slug: `1`) — initial_yaw = -37, horizon_roll = 1.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 2 | navigation | -1 | -22 | up | 2 |
| Kembali ke Lobby | navigation | 129 | -7 | down | lobby |

### Ruang 2  (slug: `2`) — initial_yaw = -25, horizon_roll = 1
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 3 | navigation | -116 | -32 | up | 3 |
| Kembali | navigation | 123 | -22 | down | 1 |

### Ruang 3  (slug: `3`) — initial_yaw = -83, horizon_roll = 0.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Koleksi 1 (placeholder) | info | -32 | 5 | - | placeholder-3-info-1 |
| Koleksi 2 (placeholder) | info | -5 | -20 | - | placeholder-3-info-2 |
| Ruang 5 | navigation | -144 | -23 | up | 5 |
| Kembali | navigation | 136 | -35 | down | 2 |

### Ruang 4  (slug: `4`) — initial_yaw = -93, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Kembali | navigation | -80 | -43 | down | 5 |

### Ruang 5  (slug: `5`) — initial_yaw = -75, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 6 | navigation | 124 | -31 | up | 6 |
| Kembali | navigation | -135 | -20 | down | 3 |
| Ruang 4 | navigation | 162 | -46 | right | 4 |

### Ruang 6  (slug: `6`) — initial_yaw = -117, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 7 | navigation | 177 | -39 | up | 7 |
| Kembali | navigation | -106 | -43 | down | 5 |

### Ruang 7  (slug: `7`) — initial_yaw = -93, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 8 | navigation | 97 | -31 | up | 8 |
| Kembali | navigation | -93 | -40 | down | 6 |

### Ruang 8  (slug: `8`) — initial_yaw = -94, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 9 | navigation | 92 | -27 | up | 9 |
| Kembali | navigation | -89 | -30 | down | 7 |

### Ruang 9  (slug: `9`) — initial_yaw = -88, horizon_roll = 3.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 10 | navigation | -89 | -27 | up | 10 |
| Kembali | navigation | 76 | -31 | down | 8 |

### Ruang 10  (slug: `10`) — initial_yaw = -94, horizon_roll = 3.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 11 | navigation | 115 | -29 | up | 11 |
| Kembali | navigation | 84 | -28 | down | 9 |

### Ruang 11  (slug: `11`) — initial_yaw = -85, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 12 | navigation | 99 | -46 | up | 12 |
| Kembali | navigation | -104 | -30 | down | 10 |

### Ruang 12  (slug: `12`) — initial_yaw = -88, horizon_roll = 3
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 13 | navigation | 87 | -23 | up | 13 |
| Kembali | navigation | -158 | -46 | down | 11 |

### Ruang 13  (slug: `13`) — initial_yaw = -97, horizon_roll = 3.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 14 | navigation | 92 | -25 | up | 14 |
| Kembali | navigation | -92 | -26 | down | 12 |

### Ruang 14  (slug: `14`) — initial_yaw = -3, horizon_roll = 4
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 15 | navigation | -5 | -27 | up | 15 |
| Kembali | navigation | -178 | -28 | down | 13 |

### Ruang 15  (slug: `15`) — initial_yaw = -92, horizon_roll = 1.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 16 | navigation | 85 | -29 | up | 16 |
| Kembali | navigation | 173 | -30 | down | 14 |

### Ruang 16  (slug: `16`) — initial_yaw = -96, horizon_roll = 1
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Ruang 17 | navigation | 110 | -29 | up | 17 |
| Kembali | navigation | 84 | -21 | down | 15 |

### Ruang 17  (slug: `17`) — initial_yaw = -93, horizon_roll = 1.5
| label | type | yaw | pitch | arrow | target |
|---|---|---|---|---|---|
| Kembali | navigation | -123 | -26 | down | 16 |

---

## 5. Catatan untuk Backend (urut prioritas)

### A. Perlu diperbaiki (ada yang keliru)

1. **`portal_url` salah arah** — di `CollectionResource.php` (baris ~32),
   `portal_url` diarahkan ke endpoint API VR sendiri
   (`.../api/vr/collections/{id}`), padahal harusnya ke halaman **Web Portal**
   koleksi. Akibatnya tombol "Selengkapnya di Web Portal →" di
   [`HotspotInfo.tsx`](../components/vr/HotspotInfo.tsx) membuka JSON API, bukan
   halaman portal.

2. **🔒 Area restricted belum diamankan backend** — FE sudah punya gerbang login
   untuk ruang `restricted-*` (`RestrictedLoginModal` + gate di `VRScene.tsx`),
   tapi endpoint datanya `GET /api/vr/scenes/restricted-*` **masih publik**. Jadi
   gate FE hanya mencegah akses via URL/klik di dalam app — orang teknis tetap
   bisa `fetch` langsung endpoint-nya. **Backend perlu mewajibkan token
   (`auth:sanctum`)** untuk ruang yang `is_restricted = true` (kolomnya sudah ada
   di `vr_rooms`), dan FE mengirim token dari login. Selama ini belum ada,
   keamanan restricted bersifat kosmetik.

### B. Perlu ditambahkan (fitur FE sudah siap, backend belum menyediakan)

**Spesifikasi field + kolom DB lengkapnya ada di [`API.md`](API.md)** (tabel
field Hotspot & bagian "Proposed Additions") — jangan diduplikasi di sini.
Ringkas, yang belum ada di backend:

- `vr_rooms.horizon_roll` — koreksi kemiringan horizon per ruang.
- `vr_hotspots.variant` (`arrow`|`door`) — hotspot pintu tegak.
- `vr_hotspots.arrow_deg` — rotasi bebas arah panah.
- `vr_hotspots.transition_url` — frame "pintu terbuka" sebelum masuk ruang.

Selain itu, dua field yang backend-nya sudah ada tapi terbatas/kosong:

- **`photos` koleksi baru 1 foto** — `CollectionResource` cuma ambil `image_url`
  tunggal per `Anatomy`; FE (`MediaGallery`) mendukung galeri banyak foto →
  butuh relasi foto koleksi (one-to-many).
- **`audio_url` selalu `null`** — voice-over (`AudioPlayer`) tak akan muncul
  sampai backend menyediakan sumber audionya.
- **`thumbnail_url` sebaiknya gambar KECIL** — preview ruang di modal Denah kini
  memakai panorama 360 penuh (berat, ~beberapa MB × 18 ruang); sediakan
  thumbnail teroptimasi.

### C. Perlu disepakati / menunggu data (belum tentu salah)

5. **Data seed vs data asli** — seed backend masih 4 ruang demo (foto
   Cloudinary). Data 18 ruang asli hasil kalibrasi ada di **Bagian 4**, tinggal
   diporting **dengan hati-hati soal konversi yaw** (lihat **Bagian 2**).
6. **Slug ruang final** — slug `1`..`17`/`lobby` di Bagian 4 masih placeholder;
   samakan dengan nama ruang asli begitu FK menetapkannya. Hotspot info di
   Ruang 3 juga masih pakai `collection_id` placeholder.

### D. Sudah benar ✅

- 3 endpoint (`/vr/scenes`, `/vr/scenes/{id}`, `/vr/collections/{id}`) sesuai kontrak.
- Menerima UUID maupun slug (`orWhere`).
- Koleksi diambil dari model `Anatomy` → satu sumber data dengan Portal &
  Multimedia (tidak ada tabel koleksi duplikat).
- Relasi one-to-many hotspot → multi-hotspot per ruang sudah didukung.
- Mapping `hotspot_type` (`link_to_room`/`open_info_modal` → `navigation`/`info`) benar.
