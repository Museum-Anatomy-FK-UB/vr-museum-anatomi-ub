# Folder Structure Guide — vr-museum-anatomi-ub

This document explains the folder structure of the 360° Web VR Tour project and
the code conventions used. Please read it before adding new files/components.

---

## Overview

```
vr-museum-anatomi-ub/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (metadata, fonts, global styles)
│   ├── page.tsx            # Homepage (redirects to /vr)
│   └── vr/
│       ├── page.tsx        # VR landing page — list of all rooms
│       └── [sceneId]/
│           └── page.tsx    # Active scene — panorama + hotspots
│
├── components/
│   ├── vr/                 # VR-specific components (use A-Frame)
│   │   ├── VRScene.tsx         # Main A-Frame scene
│   │   ├── HotspotLayer.tsx    # Renders hotspots from API data
│   │   ├── HotspotInfo.tsx     # Collection info panel (slide panel)
│   │   ├── FloorplanMap.tsx    # Museum map / floor plan overlay
│   │   └── VRModeButton.tsx    # WebXR / Cardboard toggle
│   └── ui/                 # Generic UI components (no A-Frame)
│       ├── AudioPlayer.tsx     # Voice-over player
│       ├── MediaGallery.tsx    # Collection photo gallery
│       ├── LoadingScreen.tsx   # Loading state while a scene loads
│       └── SceneCard.tsx       # Room thumbnail card on the landing page
│
├── lib/
│   ├── api.ts              # All fetch functions to the backend API
│   ├── types/
│   │   ├── tour.ts         # Types: Scene, Hotspot, NavHotspot, InfoHotspot
│   │   └── collection.ts   # Types: Collection, Photo, Audio
│   ├── hooks/
│   │   ├── useScene.ts     # SWR hook — fetch scene + hotspot data
│   │   └── useCollection.ts # SWR hook — fetch collection detail
│   └── mock/               # Mock data for dev (before the backend API is ready)
│       ├── scenes.ts
│       └── collections.ts
│
├── public/
│   ├── panorama/           # Local 360° photos for testing (see its README)
│   └── icons/              # UI icons (hotspots, navigation, etc.)
│
├── docs/                   # Technical documentation
│   ├── STRUCTURE.md        # This file
│   └── API.md              # API endpoint contract
│
├── CLAUDE.md               # Project context for the AI assistant
├── README.md               # Project overview & setup guide
├── .env.example            # Environment variable template
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

---

## Important Rules

### A-Frame Components
Every component that uses A-Frame (`<a-scene>`, `<a-sky>`, etc.) MUST:
1. Live in the `components/vr/` folder
2. Be imported via `dynamic()` with `ssr: false`
3. Never be imported directly in a Server Component

Correct import example:
```tsx
import dynamic from 'next/dynamic';

const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});
```

### Data & API
- Every backend fetch MUST go through a function in `lib/api.ts`
- Do not fetch directly from a component without going through hooks or `api.ts`
- Mock data for development lives in `lib/mock/` — used until the backend
  endpoints are ready, then switched to the real API via `api.ts`

### 360° Photo Assets
- Development placeholders: `public/panorama/` (see `public/panorama/README.md`)
- Production assets (real photos from FK): stored on the UB server's file
  storage, accessed via a URL from the API (`panorama_url` in the scene response)
- DO NOT commit high-resolution 360° photos to the Git repository
  (large files — use the server storage instead)

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React component | PascalCase | `VRScene.tsx`, `HotspotInfo.tsx` |
| Hooks | camelCase + `use` prefix | `useScene.ts` |
| Utility / lib | camelCase | `api.ts`, `formatters.ts` |
| Type / Interface | PascalCase | `Scene`, `Hotspot`, `Collection` |
| Scene ID (URL) | kebab-case | `ruang-osteologi`, `ruang-lobby` |
| Env variable | SCREAMING_SNAKE_CASE | `NEXT_PUBLIC_API_BASE_URL` |

---

## Adding a New Feature

1. Create a branch from `develop`: `git checkout -b feature/feature-name`
2. Decide whether the component goes in `components/vr/` (uses A-Frame) or `components/ui/`
3. If new data is needed, add a fetch function in `lib/api.ts` + a type in `lib/types/`
4. If the endpoint doesn't exist on the backend yet, add a mock in `lib/mock/` first
5. Update `docs/API.md` if you introduce a new endpoint requirement
6. Commit using the convention (see README), open a PR into `develop`
