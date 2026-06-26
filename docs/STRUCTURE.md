# Panduan Struktur Folder — vr-museum-anatomi-ub

Dokumen ini menjelaskan struktur folder project Web VR Tour 360° dan konvensi
kode yang dipakai. Wajib dibaca sebelum mulai menambah file/komponen baru.

---

## Gambaran Umum

```
vr-museum-anatomi-ub/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (metadata, font, global style)
│   ├── page.tsx            # Homepage (redirect ke /vr)
│   └── vr/
│       ├── page.tsx        # Landing page VR — daftar semua ruang
│       └── [sceneId]/
│           └── page.tsx    # Scene aktif — panorama + hotspot
│
├── components/
│   ├── vr/                 # Komponen spesifik VR (pakai A-Frame)
│   │   ├── VRScene.tsx         # A-Frame scene utama
│   │   ├── HotspotLayer.tsx    # Render hotspot dari data API
│   │   ├── HotspotInfo.tsx     # Panel info koleksi (slide panel)
│   │   ├── FloorplanMap.tsx    # Overlay peta/denah museum
│   │   └── VRModeButton.tsx    # Toggle WebXR / Cardboard
│   └── ui/                 # Komponen UI umum (tanpa A-Frame)
│       ├── AudioPlayer.tsx     # Player voice over
│       ├── MediaGallery.tsx    # Galeri foto koleksi
│       ├── LoadingScreen.tsx   # Loading state saat scene load
│       └── SceneCard.tsx       # Card thumbnail ruang di landing page
│
├── lib/
│   ├── api.ts              # Semua fungsi fetch ke backend API
│   ├── types/
│   │   ├── tour.ts         # Type: Scene, Hotspot, NavHotspot, InfoHotspot
│   │   └── collection.ts   # Type: Collection, Photo, Audio
│   ├── hooks/
│   │   ├── useScene.ts     # SWR hook — fetch data scene + hotspot
│   │   └── useCollection.ts # SWR hook — fetch detail koleksi
│   └── mock/               # Mock data untuk dev (sebelum API backend siap)
│       ├── scenes.ts
│       └── collections.ts
│
├── public/
│   ├── placeholder/        # Foto 360° placeholder (dev sebelum aset FK ada)
│   │   ├── lobby.jpg
│   │   ├── osteologi.jpg
│   │   └── ...
│   └── icons/              # Icon UI (hotspot, navigasi, dll)
│
├── docs/                   # Dokumentasi teknis
│   ├── STRUCTURE.md        # File ini
│   └── API.md              # Kontrak endpoint API
│
├── CLAUDE.md               # Konteks project untuk AI assistant
├── README.md               # Gambaran project & cara setup
├── .env.example            # Template environment variables
├── next.config.js          # Konfigurasi Next.js
├── tailwind.config.ts      # Konfigurasi Tailwind
└── tsconfig.json           # Konfigurasi TypeScript
```

---

## Aturan Penting

### Komponen A-Frame
Semua komponen yang menggunakan A-Frame (`<a-scene>`, `<a-sky>`, dll) WAJIB:
1. Berada di folder `components/vr/`
2. Di-import menggunakan `dynamic()` dengan `ssr: false`
3. Tidak di-import langsung di Server Component

Contoh import yang benar:
```tsx
import dynamic from 'next/dynamic';

const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});
```

### Data & API
- Semua fetch ke backend WAJIB melalui fungsi di `lib/api.ts`
- Jangan fetch langsung dari komponen tanpa melalui hooks atau `api.ts`
- Mock data untuk development ada di `lib/mock/` — dipakai sampai endpoint
  backend siap, lalu di-switch ke API real lewat `api.ts`

### Aset Foto 360°
- Placeholder untuk development: `public/placeholder/`
- Aset produksi (foto asli dari FK): disimpan di file storage server UB,
  diakses via URL dari API (`panorama_url` di response scene)
- JANGAN commit foto 360° resolusi tinggi ke repository Git
  (ukuran besar — gunakan storage server)

---

## Konvensi Penamaan

| Tipe | Convention | Contoh |
|---|---|---|
| Komponen React | PascalCase | `VRScene.tsx`, `HotspotInfo.tsx` |
| Hooks | camelCase + prefix `use` | `useScene.ts` |
| Utility / lib | camelCase | `api.ts`, `formatters.ts` |
| Type / Interface | PascalCase | `Scene`, `Hotspot`, `Collection` |
| Scene ID (URL) | kebab-case | `ruang-osteologi`, `ruang-lobby` |
| Env variable | SCREAMING_SNAKE_CASE | `NEXT_PUBLIC_API_BASE_URL` |

---

## Alur Penambahan Fitur Baru

1. Buat branch dari `develop`: `git checkout -b feature/nama-fitur`
2. Tentukan komponen masuk `components/vr/` (pakai A-Frame) atau `components/ui/`
3. Jika butuh data baru, tambahkan fungsi fetch di `lib/api.ts` + type di `lib/types/`
4. Jika endpoint belum ada di backend, buat dulu mock di `lib/mock/`
5. Update `docs/API.md` jika menambah kebutuhan endpoint baru
6. Commit dengan convention (lihat README), buat PR ke `develop`
