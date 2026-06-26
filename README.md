# vr-museum-anatomi-ub

Web Virtual Museum 360° — bagian dari Ekosistem Digital Museum Anatomi Fakultas Kedokteran Universitas Brawijaya.

Aplikasi ini memungkinkan pengguna menjelajahi seluruh ruangan Museum Anatomi FK UB secara virtual melalui browser, kapan saja dan di mana saja, tanpa perlu mengunjungi lokasi fisik. Hotspot interaktif menampilkan informasi koleksi anatomi yang diambil secara dinamis dari database terpusat ekosistem.

> **Status:** Tahap perencanaan / proposal — belum mulai development.
> **PIC:** Anak Agung Ngurah Aditya Wirayudha
> **Bagian dari:** [Ekosistem Digital Museum Anatomi FK UB](https://museumanatomi.ub.ac.id) — Lab MGM FILKOM UB

---

## Fitur Utama

- Tur Virtual 360° multi-ruang (Lobby, Anatomi Dasar, Osteologi, Organ Dalam, Histologi, Embriologi)
- Navigasi antar ruang via hotspot dan peta/denah museum
- Hotspot informasi koleksi — foto, deskripsi, voice over, link ke Web Portal
- Mode VR (WebXR / Google Cardboard) via tombol toggle
- URL unik per ruang (`/vr/osteologi`) — dapat di-share dan di-bookmark
- Semua konten dikelola dari CMS terpusat, tidak hardcode

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 14 (App Router) |
| VR / 360° Engine | A-Frame 1.5+ |
| 3D Renderer | Three.js (dependency A-Frame) |
| Styling | Tailwind CSS |
| Data Fetching | SWR + Fetch API |
| Backend / API | Laravel REST API (dikembangkan tim Backend) |
| Database | MySQL (terpusat, shared dgn seluruh ekosistem) |
| Deployment | Nginx — Server UB (`vr.museumanatomi.ub.ac.id`) |

---

## Struktur Folder

Lihat [`docs/STRUCTURE.md`](docs/STRUCTURE.md) untuk panduan lengkap.

```
vr-museum-anatomi-ub/
├── app/                  # Next.js App Router (halaman & layout)
├── components/           # Komponen React / A-Frame
├── lib/                  # Utility, API client, hooks
├── public/               # Aset statis (placeholder 360°, dll)
├── docs/                 # Dokumentasi teknis
└── ...
```

---

## Dokumentasi

| File | Isi |
|---|---|
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Panduan struktur folder & konvensi kode |
| [`docs/API.md`](docs/API.md) | Kontrak endpoint API (untuk align dgn tim Backend) |
| [`CLAUDE.md`](CLAUDE.md) | Konteks project untuk AI assistant |

---

## Setup Development

> Prasyarat: Node.js 18+, npm / pnpm

```bash
# 1. Clone repository
git clone <repo-url>
cd vr-museum-anatomi-ub

# 2. Install dependencies
npm install

# 3. Salin file environment
cp .env.example .env.local
# Edit .env.local — isi API_BASE_URL dll

# 4. Jalankan development server
npm run dev
# Buka http://localhost:3000
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api    # URL API backend (lokal)
NEXT_PUBLIC_STORAGE_URL=http://localhost:8000/storage # URL file storage
```

---

## Build & Deploy

```bash
# Build production
npm run build

# Jalankan production server (lokal)
npm run start
```

Deployment ke server UB menggunakan Nginx. Detail konfigurasi menyusul setelah server siap.

---

## Git Workflow

Branch convention:
```
main          → production-ready (protected)
develop       → integrasi semua fitur
feature/xxx   → fitur baru (contoh: feature/hotspot-info)
fix/xxx       → bugfix (contoh: fix/vr-mode-mobile)
```

Cara kontribusi:
```bash
# 1. Buat branch dari develop
git checkout develop
git pull origin develop
git checkout -b feature/nama-fitur

# 2. Kerjakan fitur, commit dengan pesan yang jelas
git commit -m "feat: tambah hotspot navigasi antar ruang"

# 3. Push dan buat Pull Request ke develop
git push origin feature/nama-fitur
```

Commit message convention:
```
feat:     fitur baru
fix:      bugfix
chore:    setup, konfigurasi
docs:     perubahan dokumentasi
refactor: refactor kode (bukan fitur baru / bukan bugfix)
```

---

## Tim

| Nama | Peran | Scope |
|---|---|---|
| Dr. Eng. Herman Tolle | Project Manager / Koordinator | Seluruh ekosistem |
| Azarya Aria Alfathan | Lead Developer | Seluruh ekosistem / AR |
| **Anak Agung Ngurah Aditya Wirayudha** | **PIC Web VR** | **Repo ini** |
| Ahmad Akmal Syafi'i | Web Developer | VR / DB & Backend |
| Azkal Baihaq | Web Developer | AR / DB & Backend |
| Bintang Ula Nur Maghfiroh | Web Developer | Website Portal |
| Shatara Belva Maritza | Web Developer | Multimedia |
| Zaqia Mahadewi | Web Developer | Website Portal |
| Syafa Syakira Shalsabilla | Web Developer | Multimedia |

---

## Ekosistem Digital Museum Anatomi FK UB

Repo ini adalah **satu bagian** dari ekosistem yang lebih besar:

| Produk | URL | PIC |
|---|---|---|
| Website Portal | `museumanatomi.ub.ac.id` | Bintang Ula |
| **Web VR Tour 360°** | `vr.museumanatomi.ub.ac.id` | **Aditya** |
| Web AR Dinamis | `ar.museumanatomi.ub.ac.id` | Azarya |
| Aplikasi Multimedia | — | Belva |
| Backend / API / DB | — | Azkal / Akmal |

---

*Dikembangkan oleh Lab MGM (Multimedia & Game Technology) — Fakultas Ilmu Komputer, Universitas Brawijaya*
