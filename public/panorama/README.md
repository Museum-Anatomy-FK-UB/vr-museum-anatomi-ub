# public/panorama — Foto 360° untuk testing lokal

Taruh foto 360° di sini untuk **testing lokal** (sementara, sebelum aset asli
diambil dari storage server via API — lihat `docs/API.md`).

File di folder ini bisa diakses dari URL root, contoh:

```
public/panorama/lobby.jpg   →   http://localhost:3000/panorama/lobby.jpg
```

## Syarat gambar

- **Format equirectangular** (proyeksi bola), **rasio 2:1** (mis. 4096×2048,
  8192×4096). Kalau bukan 2:1, panorama akan terlihat melar/miring.
- Format file: `.jpg` (disarankan) atau `.png`.
- Resolusi aman lintas perangkat: lebar **≤ 8192px** (banyak HP/GPU membatasi
  ukuran tekstur di 4096–8192). Kalau ragu, pakai 4096×2048.

## Cara pakai (dev, mock)

1. Taruh file di folder ini, mis. `lobby.jpg`, `osteologi.jpg`.
2. Buka `lib/mock/scenes.ts`, ganti `panorama_url` scene terkait ke path lokal:

   ```ts
   panorama_url: '/panorama/lobby.jpg',   // bukan URL CDN/backend
   ```

3. `npm run dev` → buka `/vr` → pilih ruang.

> Catatan: file gambar **tidak di-commit** ke Git (di-ignore). Yang di-track
> hanya folder + README ini. Aset produksi disajikan dari storage server, bukan repo.
