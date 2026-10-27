# vr-museum-anatomi-ub

360° Web Virtual Museum — part of the Digital Ecosystem of the Anatomy Museum, Faculty of Medicine, Universitas Brawijaya.

This app lets users explore every room of the FK UB Anatomy Museum virtually through the browser, anytime and anywhere, without visiting the physical location. Interactive hotspots surface anatomy collection information pulled dynamically from the ecosystem's centralized database.

> **Live:** [museum.anatomi360.realitas.id/vr/lobby](https://museum.anatomi360.realitas.id/vr/lobby)
> **Status:** In development — consuming the deployed backend API (Laravel, `https://museum-ub.realitas.id/api`). Rooms, hotspots and collections are managed in the backend CMS, never in this repo.
> **PIC:** Anak Agung Ngurah Aditya Wirayudha
> **Part of:** [Digital Ecosystem of the FK UB Anatomy Museum](https://museumanatomi.ub.ac.id) — MGM Lab, FILKOM UB

---

## Key Features

- **Multi-room 360° tour** — the Lobby and Ruang 1–17 are public; 9 more rooms (`restricted-18` … `restricted-26`) sit behind a login. The entry room is whichever room the API orders first.
- **Hotspots from the API**, in four types:
  - `navigation` — move to another room (arrow marker, or an upright *door* marker; a door can show a one-off "door opening" frame before the crossfade)
  - `info` — collection panel with photos, name, description and voice-over
  - `photo` — a single photo in a lightbox
  - `external_link` — opens another website (in VR the visitor is offered to leave VR first)
  - Info hotspots with no linked collection, and the placeholder labels "Hotspot N", are hidden.
- **"Little Planet" intro** on the first room of a visit, then smooth crossfade/zoom transitions between rooms.
- **Footer bar** — Main Location, All Location (room gallery), Denah (floor plan), Fullscreen, Mode VR, Show/Hide Hotspot.
- **Look and zoom** — drag/touch to look with inertia, mouse wheel to zoom (FOV 40–100°), arrow keys (see below), and a slow auto-rotate after 4 s without input.
- **Restricted area** — rooms whose slug starts with `restricted-` ask for a login (Laravel Sanctum bearer token, kept for the browser session only).
- **VR Mode (WebXR)** for standalone headsets such as **Meta Quest**, with controllers or hand tracking, an in-VR menu, tutorial guide with voice-over, and in-VR panels — see [VR headsets](#vr-headsets-meta-quest).
- **A unique URL per room** (`/vr/lobby`, `/vr/3`, …) — shareable and bookmarkable.
- **All content managed from the centralized CMS**, never hardcoded.

Keyboard (desktop): **←/→** turn the view; **↑/↓** activate the hotspot you are turned toward (or away from).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| VR / 360° Engine | A-Frame 1.8 |
| 3D Renderer | Three.js r184 (A-Frame dependency) |
| Styling | Tailwind CSS |
| Data Fetching | SWR + Fetch API |
| Backend / API | Laravel REST API (built by the Backend team) |
| Database | MySQL (centralized, shared across the whole ecosystem) |
| Deployment | Node.js app (`server.js`) on cPanel hosting — [museum.anatomi360.realitas.id](https://museum.anatomi360.realitas.id/vr/lobby) |

---

## Folder Structure

See [`docs/STRUCTURE.md`](docs/STRUCTURE.md) for the full guide.

```
vr-museum-anatomi-ub/
├── app/
│   ├── vr/                 # /vr (redirects to the first room) and /vr/[sceneId]
│   ├── api/vr-image/       # same-origin pass-through for collection photos shown in VR
│   └── dev/calibrate/      # dev-only hotspot calibration tool (404 in production)
├── components/
│   ├── vr/                 # A-Frame scene, hotspots, VR input/menu/panels/guide
│   ├── ui/                 # generic UI (gallery, audio player, loading)
│   └── dev/                # calibration tool
├── lib/                    # API client (api.ts), types, SWR hooks, VR guide content, seed data
├── public/
│   ├── panorama/           # compressed local panoramas + logos (see its README)
│   └── audio/guide/        # recorded voice-over of the VR tutorial
├── docs/                   # Technical documentation
├── server.js               # entry point for the cPanel Node.js app
└── ...
```

---

## Documentation

| File | Contents |
|---|---|
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Folder structure guide & code conventions |
| [`docs/API.md`](docs/API.md) | API endpoint contract drafted with the Backend team |
| [`docs/HANDOFF-BACKEND-VR-DATA.md`](docs/HANDOFF-BACKEND-VR-DATA.md) | Notes handed to the Backend team about VR data |
| [`docs/VR-GUIDE-VOICEOVER.md`](docs/VR-GUIDE-VOICEOVER.md) | Recording script for the VR tutorial voice-over |
| [`public/panorama/README.md`](public/panorama/README.md) | Panorama requirements and local test assets |

---

## Development Setup

> Prerequisites: Node.js 18.17+ (production runs Node 20), npm

```bash
# 1. Clone the repository
git clone <repo-url>
cd vr-museum-anatomi-ub

# 2. Install dependencies
npm install

# 3. Copy the environment file
cp .env.example .env.local
# Edit .env.local — see the table below

# 4. Run the development server
npm run dev
# Open http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

### Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL — live: `https://museum-ub.realitas.id/api`, local: `http://localhost:8000/api` |
| `NEXT_PUBLIC_STORAGE_URL` | Backend file storage URL — its host is allowed for the `/api/vr-image` pass-through |
| `NEXT_PUBLIC_LOCAL_PREVIEW` | **Dev only.** `true` serves `lib/localPreviewData.ts` and the bundled panoramas instead of calling the backend. Leave it unset or `false` for anything deployed. |
| `VR_IMAGE_HOSTS` | Optional, server-side. Extra hosts (comma-separated) whose photos `/api/vr-image` may fetch for VR panels. The API and storage hosts are always allowed. |

> `NEXT_PUBLIC_*` values are **inlined at build time**. Changing them on the server has no effect on an already built app — rebuild with the right `.env.local`.

### Dev tools

- **`/dev/calibrate`** — place hotspots visually on the local panoramas, tune each room's start direction and horizon tilt, and export JSON for the Backend team to seed. Works only in development.
- **`lib/calibrationSeed.ts`** — the bundled calibration data shared by the tool and the local preview.

### Panorama assets

The live tour loads panoramas from the URLs the API returns. `public/panorama/kompress/` holds compressed copies (5760×2880, roughly 0.7–2.7 MB each) used by the local preview; the original high-resolution photos stay out of Git (see `.gitignore`).

---

## Build & Deploy

```bash
# Production build
npm run build

# Run the production server (local)
npm run start
```

### Deploying to cPanel (Node.js App)

The live site is a cPanel **Setup Node.js App** (Node 20, startup file `server.js`, application root = this repo's clone). `server.js` wraps Next.js so Passenger can start it.

1. Make sure `.env.local` on the machine that builds points at the production API (`NEXT_PUBLIC_*` are baked in) and has `NEXT_PUBLIC_LOCAL_PREVIEW` unset or `false`.
2. Stop any `npm run dev` first, then `npm run build`. (Building while the dev server runs, or running dev on a production `.next`, corrupts the build folder — delete `.next` before going back to dev.)
3. Zip `.next` (without `.next/cache`) **keeping Unix permissions**, upload it to the application root and extract it, replacing the old `.next`.
4. Pull the latest source on the server (Git Version Control → *Update from Remote*) when `public/` assets, `next.config.js` or dependencies changed; run *Run NPM Install* when dependencies changed.
5. Restart the app in **Setup Node.js App**, then hard-refresh the site.

On Linux/macOS a plain `zip -r next-build.zip .next -x ".next/cache/*"` keeps permissions. On Windows do **not** use Explorer's "Compressed folder" or `Compress-Archive` — the extracted folders end up unreadable and the app fails with `EACCES`. Use this instead (Python 3, run from the repo root):

<details>
<summary>PowerShell: zip with permissions</summary>

```powershell
$env:ZIP_OUT = "$env:USERPROFILE\Desktop\next-build.zip"
@'
import zipfile, os, stat
out = os.environ["ZIP_OUT"]
names = set()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(".next"):
        dirs[:] = [d for d in dirs if not (root == ".next" and d == "cache")]
        rel = os.path.relpath(root, ".").replace(os.sep, "/")
        parts = rel.split("/")
        for i in range(1, len(parts) + 1):
            d = "/".join(parts[:i]) + "/"
            if d not in names:
                names.add(d)
                zi = zipfile.ZipInfo(d)
                zi.external_attr = ((0o755 | stat.S_IFDIR) << 16) | 0x10
                zf.writestr(zi, "")
        for f in files:
            zi = zipfile.ZipInfo(rel + "/" + f)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (0o644 | stat.S_IFREG) << 16
            with open(os.path.join(root, f), "rb") as fh:
                zf.writestr(zi, fh.read())
print("OK", out, os.path.getsize(out), "bytes")
'@ | python -
```

</details>

---

## Backend API used by the app

All requests go through `lib/api.ts`. The base URL is `NEXT_PUBLIC_API_BASE_URL`.

| Endpoint | Used for |
|---|---|
| `GET /vr/scenes` | Room list (gallery, floor plan, entry room) |
| `GET /vr/scenes/{slug}` | Room detail: panorama, start direction, horizon tilt, hotspots. Requires the bearer token for restricted rooms. |
| `GET /vr/collections/{slug\|uuid}` | Resolves a hotspot's collection |
| `GET /multimedia/{uuid}` | Collection name, general description and ordered photos |
| `POST /login` | Restricted-area login (returns a Sanctum token) |

The contract draft lives in [`docs/API.md`](docs/API.md). The VR app is read-only: it never writes data.

---

## VR Headsets (Meta Quest)

"Mode VR" starts an immersive WebXR session. It only works in a browser that
has a VR headset behind it — e.g. the **Meta Quest Browser** on the headset
itself (or a PC browser with Quest Link). On a normal laptop/phone browser the
button explains that no headset was detected instead of entering VR.

Requirements:
- The site must be served over **HTTPS** (browsers only expose WebXR in a secure context; `localhost` also counts).
- Panoramas load into WebGL, so their server must send **CORS** headers (`Access-Control-Allow-Origin`). Collection photos in the VR panels don't need it: they are loaded through the app's own origin (Next image optimizer, or the `/api/vr-image` pass-through limited to the backend's hosts — add other photo hosts to `VR_IMAGE_HOSTS`).
- There is no dedicated Cardboard/stereo mode for phones: "Mode VR" needs a browser that reports `immersive-vr` support.

Inside the headset:
| Input | Point | Activate |
|---|---|---|
| Touch controllers | laser from the controller | trigger |
| Hand tracking | laser from the hand | pinch |
| No controller/hand (e.g. Cardboard) | dot in the center of view | look at a hotspot for 1s |

**Guide (Panduan).** When VR starts at — or first arrives at — the Main
Location, a step-by-step tutorial opens in front of the visitor: an animated
illustration, short text and a recorded voice-over per step, in a **controller**
track and a **hand-tracking** track (it follows whichever is in use and can be
switched). It opens in **every VR session** (each press of "Mode VR" — the
headset is shared by many visitors), once per session: going back to the Main
Location doesn't repeat it. *Lewati* skips it and the menu's
**Panduan** button reopens it. Wording lives in `lib/vrGuide.ts`; the recording
script and file names are in [docs/VR-GUIDE-VOICEOVER.md](docs/VR-GUIDE-VOICEOVER.md)
and the MP3s are in `public/audio/guide/` (steps without a file play silently).
The voice-over is **spatial audio**: it is heard coming from the guide panel
(Web Audio HRTF panner placed at the panel, listener following the headset), so
it stays put as the visitor turns — turning away puts it behind them, which
draws them back to the panel.

The menu (Main Location, All Location, Denah, Show/Hide Hotspot, Panduan, Keluar VR —
the same actions as the 2D footer bar) is **closed by default**. A small
**Menu** button floats just above the **left controller / left hand** (like a
Quest wrist menu), so it is always within reach and never in front of a
hotspot. Opening it shows the bar in front of the chest; it closes again after
use and when you move to another room.
| Input | Open / close the menu |
|---|---|
| Touch controllers | **B** or **Y** — or right laser + trigger on the Menu button |
| Hand tracking | **tap it with your right index finger** — or right-hand laser + pinch |
| No controller/hand | look at the Menu button (floating low in front) for 1s |

Hands and controllers are drawn in VR: your tracked hands (like in the Quest
home) or the Touch controller models. With hand tracking, menu, panel and
keyboard buttons can be **touched directly with a fingertip** — like the Quest's
own keyboard — and those panels open within arm's reach (scaled so they look the
same size). The hand's laser steps aside while the finger is near a button.

In the emulator's Play mode the controllers are fixed to your view, so use
right Shift (B) / Z (Y) to open the menu.

Arriving in a room, its intended view (`initial_yaw`) is placed **wherever you
are facing** — the room (panorama and hotspots together) is turned to you, the
way the 2D view re-centers, instead of forcing the headset camera.

Info/photo hotspots open a panel **inside VR** (HTML modals are invisible in a
headset). The restricted-area login also works inside VR: a virtual keyboard
is typed on with the laser (trigger) or a pinch — a paired Bluetooth keyboard
works too — and it uses the same backend login as the website form. External
links can't open inside VR, so the visitor is offered to leave VR for them.

Testing without a headset: the [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik)
browser extension (by Meta) emulates a Quest, including controllers and hands.

---

## Git Workflow

Branch convention:
```
main          → production-ready (protected)
develop       → integration of all features
feature/xxx   → new feature (e.g. feature/hotspot-info)
fix/xxx       → bugfix (e.g. fix/vr-mode-mobile)
```

How to contribute:
```bash
# 1. Create a branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/feature-name

# 2. Work on the feature, commit with clear messages
git commit -m "feat: add room-to-room navigation hotspot"

# 3. Push and open a Pull Request into develop
git push origin feature/feature-name
```

Releases go from `develop` to `main` through a Pull Request.

Commit message convention:
```
feat:     new feature
fix:      bugfix
chore:    setup, configuration
docs:     documentation changes
refactor: code refactor (not a new feature / not a bugfix)
```

---

## Team

| Name | Role | Scope |
|---|---|---|
| Dr. Eng. Herman Tolle | Project Manager / Coordinator | Whole ecosystem |
| Azarya Aria Alfathan | Lead Developer | Whole ecosystem / AR |
| **Anak Agung Ngurah Aditya Wirayudha** | **Web VR PIC** | **This repo** |
| Ahmad Akmal Syafi'i | Web Developer | VR / DB & Backend |
| Azkal Baihaq | Web Developer | AR / DB & Backend |
| Bintang Ula Nur Maghfiroh | Web Developer | Website Portal |
| Shatara Belva Maritza | Web Developer | Multimedia |
| Zaqia Mahadewi | Web Developer | Website Portal |
| Syafa Syakira Shalsabilla | Web Developer | Multimedia |

---

## FK UB Anatomy Museum Digital Ecosystem

This repo is **one part** of a larger ecosystem:

| Product | URL | PIC |
|---|---|---|
| Website Portal | [museumanatomi.ub.ac.id](https://museumanatomi.ub.ac.id/) | Bintang Ula |
| **360° Web VR Tour** | [museum.anatomi360.realitas.id/vr/lobby](https://museum.anatomi360.realitas.id/vr/lobby) | **Aditya** |
| Dynamic Web AR | [Anatomi3D.apk](https://museumanatomi.ub.ac.id/downloads/Anatomi3D.apk) (Android app) | Azarya |
| Multimedia App | [multimedia-anatomi.realitas.id](https://multimedia-anatomi.realitas.id/) | Belva |
| Backend / API / DB | — | Azkal / Akmal |

---

*Developed by MGM Lab (Multimedia & Game Technology) — Faculty of Computer Science, Universitas Brawijaya*
