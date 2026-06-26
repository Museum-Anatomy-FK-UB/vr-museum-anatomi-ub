# Kontrak API — Web VR Tour 360°

Draft endpoint yang dibutuhkan oleh Web VR. Dokumen ini dibuat oleh tim VR
sebagai **proposal ke tim Backend (Azkal / Akmal)** untuk di-review dan
diimplementasikan.

> **Status:** Draft — belum final, perlu alignment dengan tim Backend.

---

## Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:8000/api` |
| Production | `https://museumanatomi.ub.ac.id/api` |

Dikonfigurasi via `NEXT_PUBLIC_API_BASE_URL` di `.env.local`.

---

## 1. `GET /api/vr/scenes`

Mengambil daftar semua ruang yang tersedia untuk VR Tour.
Digunakan di halaman landing `/vr`.

**Response:**
```json
{
  "data": [
    {
      "id": "ruang-lobby",
      "title": "Lobby Museum",
      "thumbnail_url": "/storage/thumbs/lobby.jpg",
      "order": 1
    },
    {
      "id": "ruang-osteologi",
      "title": "Ruang Osteologi",
      "thumbnail_url": "/storage/thumbs/osteologi.jpg",
      "order": 2
    }
  ]
}
```

---

## 2. `GET /api/vr/scenes/:sceneId`

Mengambil detail satu scene beserta semua hotspot-nya.
Digunakan saat user membuka `/vr/[sceneId]`.

**Response:**
```json
{
  "data": {
    "id": "ruang-osteologi",
    "title": "Ruang Osteologi",
    "panorama_url": "/storage/360/osteologi.jpg",
    "thumbnail_url": "/storage/thumbs/osteologi.jpg",
    "initial_yaw": 0,
    "initial_pitch": 0,
    "hotspots": [
      {
        "id": "hs-001",
        "type": "navigation",
        "yaw": 90,
        "pitch": 0,
        "label": "Ruang Organ Dalam",
        "target_scene_id": "ruang-organ-dalam"
      },
      {
        "id": "hs-002",
        "type": "info",
        "yaw": -30,
        "pitch": -10,
        "label": "Tengkorak Manusia",
        "collection_id": "skull-001"
      }
    ]
  }
}
```

**Field `hotspot.type`:**
- `navigation` — pindah ke ruang lain (`target_scene_id` wajib ada)
- `info` — tampil panel info koleksi (`collection_id` wajib ada)

**Field posisi hotspot:**
- `yaw` — rotasi horizontal dalam derajat (-180 sampai 180)
- `pitch` — rotasi vertikal dalam derajat (-90 sampai 90)

---

## 3. `GET /api/collections/:id`

Mengambil detail satu item koleksi. Dipanggil saat user klik hotspot `info`.
Data ini **sama** dengan yang dipakai Web Portal & Multimedia App
(satu sumber data, tidak ada duplikasi).

**Response:**
```json
{
  "data": {
    "id": "skull-001",
    "name": "Tengkorak Manusia",
    "latin_name": "Cranium",
    "category": "Sistem Rangka",
    "description": "Tengkorak manusia tersusun atas 22 tulang...",
    "photos": [
      {
        "url": "/storage/collections/skull-001-1.jpg",
        "caption": "Tampak depan"
      }
    ],
    "audio_url": "/storage/audio/skull-001.mp3",
    "video_url": null,
    "portal_url": "https://museumanatomi.ub.ac.id/koleksi/skull-001"
  }
}
```

---

## Catatan untuk Tim Backend

1. **CORS** — `panorama_url` dan semua URL aset harus berupa URL absolut
   atau path yang bisa diakses dari domain VR (`vr.museumanatomi.ub.ac.id`).
   Perlu konfigurasi CORS di server.

2. **Caching** — Endpoint `/api/vr/scenes` sebaiknya di-cache aggressively
   karena dipanggil setiap halaman landing dibuka. Sesuai arahan koordinator
   (slide 18 proposal): hindari membebani server langsung — gunakan
   mirroring/view data.

3. **Konsistensi data** — `collection_id` di hotspot harus merujuk ke `id`
   yang sama di tabel koleksi yang dipakai Web Portal dan Multimedia. Tidak
   boleh ada tabel koleksi terpisah untuk VR.

4. **Development paralel** — Selama endpoint ini belum siap, tim VR memakai
   mock data lokal di `lib/mock/`. Begitu endpoint live, tinggal switch
   `NEXT_PUBLIC_API_BASE_URL` dan fungsi di `lib/api.ts`.

5. **Error handling** — Mohon konsisten: response error pakai HTTP status
   code yang tepat (404 untuk scene/koleksi tidak ditemukan, 500 untuk server
   error) dengan body `{ "message": "..." }`.

---

## Pending / Perlu Dibahas

- [ ] Apakah perlu endpoint untuk daftar koleksi per kategori (galeri per ruang)?
- [ ] Format `audio_url` — apakah ada transkrip teks voice over juga?
- [ ] Apakah `panorama_url` butuh varian multi-resolusi (tiling) untuk foto
      resolusi sangat tinggi? (tunggu kepastian resolusi foto dari tim FK)
- [ ] Skema autentikasi jika nanti ada konten khusus mahasiswa FK
