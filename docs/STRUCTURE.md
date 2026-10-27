# Folder Structure Guide — vr-museum-anatomi-ub

This document explains the folder structure of the 360° Web VR Tour project and
the code conventions used. Please read it before adding new files/components.

---

## Overview

```
vr-museum-anatomi-ub/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (metadata, global styles)
│   ├── page.tsx            # Homepage (redirects to /vr)
│   ├── vr/
│   │   ├── page.tsx        # Entry — redirects to the first room the API returns
│   │   └── [sceneId]/
│   │       └── page.tsx    # Active scene — panorama + hotspots
│   ├── api/vr-image/
│   │   └── route.ts        # Same-origin pass-through for collection photos shown in VR
│   └── dev/calibrate/
│       └── page.tsx        # Dev-only hotspot calibration tool (404 in production)
│
├── components/
│   ├── vr/                 # VR-specific components (use A-Frame)
│   │   ├── VRScene.tsx         # Main A-Frame scene
│   │   ├── HotspotLayer.tsx    # Renders hotspots from API data
│   │   ├── HotspotInfo.tsx     # Collection info modal (2D)
│   │   ├── HotspotPhotoModal.tsx # Single-photo lightbox (2D)
│   │   ├── SceneControlsBar.tsx  # Footer bar (Main Location, All Location, Denah, …)
│   │   ├── SceneGallery.tsx    # "All Location" room gallery (2D)
│   │   ├── RestrictedLoginModal.tsx # Login for restricted rooms (2D)
│   │   ├── FloorplanMap.tsx    # Museum map / floor plan overlay
│   │   ├── VRPanels.tsx        # In-headset info/photo/notice/login panels (VR mode)
│   │   ├── xrPointer.ts        # Controller/hand lasers, trigger/pinch & gaze input (VR mode)
│   │   ├── VRMenu.tsx          # In-headset menu bar, All Location & Denah panels (VR mode)
│   │   ├── VRGuide.tsx         # In-headset tutorial panel + voice-over playback (VR mode)
│   │   ├── guideArt.ts         # Canvas-drawn animations for the tutorial steps
│   │   ├── smoothDragLook.ts, scrollZoom.ts, idleRotate.ts  # 2D look/zoom/auto-rotate controls
│   │   ├── skyCrossfade.ts, littlePlanetIntro.ts            # Panorama transitions and the intro
│   │   └── VRModeButton.tsx    # Standalone "Mode VR" button (currently unused — the footer bar starts VR)
│   ├── ui/                 # Generic UI components (no A-Frame)
│   │   ├── AudioPlayer.tsx     # Voice-over player
│   │   ├── MediaGallery.tsx    # Collection photo gallery
│   │   └── LoadingScreen.tsx   # Loading state while a scene loads
│   └── dev/
│       └── CalibrationTool.tsx # Hotspot calibration editor (dev only)
│
├── lib/
│   ├── api.ts              # All fetch functions to the backend API, plus login + token handling
│   ├── vrGuide.ts          # VR tutorial content: step text, voice-over script, audio file names
│   ├── calibrationSeed.ts  # Bundled calibration data (shared by /dev/calibrate and the local preview)
│   ├── localPreviewData.ts # Dev-only data for NEXT_PUBLIC_LOCAL_PREVIEW=true
│   ├── types/
│   │   ├── tour.ts         # Types: Scene, Hotspot (navigation / info / photo / external_link)
│   │   └── collection.ts   # Types: Collection, CollectionPhoto
│   └── hooks/
│       ├── useScene.ts     # SWR hook — room list (used by the /vr entry redirect)
│       └── useCollection.ts # SWR hook — fetch collection detail
│
├── public/
│   ├── panorama/           # Compressed local panoramas + logos (see its README)
│   └── audio/guide/        # Recorded voice-over for the VR tutorial (see its README)
│
├── docs/                   # Technical documentation
│   ├── STRUCTURE.md        # This file
│   ├── API.md              # API endpoint contract
│   ├── HANDOFF-BACKEND-VR-DATA.md # Status of the VR data handed to the Backend team
│   └── VR-GUIDE-VOICEOVER.md # Recording script for the VR tutorial voice-over
│
├── server.js               # Entry point for the cPanel Node.js app
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
- All data comes live from the backend API (`NEXT_PUBLIC_API_BASE_URL`). The only
  exception is the dev-only `NEXT_PUBLIC_LOCAL_PREVIEW=true` mode
  (`lib/localPreviewData.ts`), which must stay off for anything deployed

### 360° Photo Assets
- Production assets (real photos from FK) come from the backend, via a URL in
  the API (`panorama_url` in the scene response)
- `public/panorama/kompress/` holds compressed copies (5760×2880, ~0.7–2.7 MB
  each) for the local preview — the only panoramas tracked in Git (see
  `public/panorama/README.md`)
- DO NOT commit the original high-resolution 360° photos to the Git repository
  (large files — keep them local or on the server storage)

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React component | PascalCase | `VRScene.tsx`, `HotspotInfo.tsx` |
| Hooks | camelCase + `use` prefix | `useScene.ts` |
| Utility / lib | camelCase | `api.ts`, `formatters.ts` |
| Type / Interface | PascalCase | `Scene`, `Hotspot`, `Collection` |
| Scene ID (URL) | the backend's slug (`slug_name`) | `lobby`, `3`, `restricted-18` |
| Env variable | SCREAMING_SNAKE_CASE | `NEXT_PUBLIC_API_BASE_URL` |

---

## Adding a New Feature

1. Create a branch from `develop`: `git checkout -b feature/feature-name`
2. Decide whether the component goes in `components/vr/` (uses A-Frame) or `components/ui/`
3. If new data is needed, add a fetch function in `lib/api.ts` + a type in `lib/types/`
4. Update `docs/API.md` if you introduce a new endpoint requirement
5. Commit using the convention (see README), open a PR into `develop`
