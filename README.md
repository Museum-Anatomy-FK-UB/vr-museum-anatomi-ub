# vr-museum-anatomi-ub

360° Web Virtual Museum — part of the Digital Ecosystem of the Anatomy Museum, Faculty of Medicine, Universitas Brawijaya.

This app lets users explore every room of the FK UB Anatomy Museum virtually through the browser, anytime and anywhere, without visiting the physical location. Interactive hotspots surface anatomy collection information pulled dynamically from the ecosystem's centralized database.

> **Status:** In development — now consuming the real backend API (Laravel); pending production 360° photo/collection assets from FK.
> **PIC:** Anak Agung Ngurah Aditya Wirayudha
> **Part of:** [Digital Ecosystem of the FK UB Anatomy Museum](https://museumanatomi.ub.ac.id) — MGM Lab, FILKOM UB

---

## Key Features

- Multi-room 360° virtual tour (Lobby, Basic Anatomy, Osteology, Internal Organs, Histology, Embryology)
- Room-to-room navigation via hotspots and a museum floor plan / map
- Collection info hotspots — photos, description, voice-over, and a link to the Web Portal
- VR Mode (WebXR) for standalone headsets such as **Meta Quest** — see [VR headsets](#vr-headsets-meta-quest)
- A unique URL per room (`/vr/osteologi`) — shareable and bookmarkable
- All content managed from a centralized CMS, never hardcoded

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| VR / 360° Engine | A-Frame 1.5+ |
| 3D Renderer | Three.js (A-Frame dependency) |
| Styling | Tailwind CSS |
| Data Fetching | SWR + Fetch API |
| Backend / API | Laravel REST API (built by the Backend team) |
| Database | MySQL (centralized, shared across the whole ecosystem) |
| Deployment | Nginx — UB Server (`vr.museumanatomi.ub.ac.id`) |

---

## Folder Structure

See [`docs/STRUCTURE.md`](docs/STRUCTURE.md) for the full guide.

```
vr-museum-anatomi-ub/
├── app/                  # Next.js App Router (pages & layout)
├── components/           # React / A-Frame components
├── lib/                  # Utilities, API client, hooks
├── public/               # Static assets (360° placeholders, etc.)
├── docs/                 # Technical documentation
└── ...
```

---

## Documentation

| File | Contents |
|---|---|
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Folder structure guide & code conventions |
| [`docs/API.md`](docs/API.md) | API endpoint contract (to align with the Backend team) |
| [`CLAUDE.md`](CLAUDE.md) | Project context for the AI assistant |

---

## Development Setup

> Prerequisites: Node.js 18+, npm / pnpm

```bash
# 1. Clone the repository
git clone <repo-url>
cd vr-museum-anatomi-ub

# 2. Install dependencies
npm install

# 3. Copy the environment file
cp .env.example .env.local
# Edit .env.local — set API_BASE_URL, etc.

# 4. Run the development server
npm run dev
# Open http://localhost:3000
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api    # Backend API URL (local)
NEXT_PUBLIC_STORAGE_URL=http://localhost:8000/storage # File storage URL
```

---

## Build & Deploy

```bash
# Production build
npm run build

# Run the production server (local)
npm run start
```

Deployment to the UB server uses Nginx. Configuration details will follow once the server is ready.

---

## VR Headsets (Meta Quest)

"Mode VR" starts an immersive WebXR session. It only works in a browser that
has a VR headset behind it — e.g. the **Meta Quest Browser** on the headset
itself (or a PC browser with Quest Link). On a normal laptop/phone browser the
button explains that no headset was detected instead of entering VR.

Requirements:
- The site must be served over **HTTPS** (browsers only expose WebXR in a secure context; `localhost` also counts).
- Collection photos and panoramas load into WebGL, so the storage server must send **CORS** headers (`Access-Control-Allow-Origin`) for them.

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
| Website Portal | `museumanatomi.ub.ac.id` | Bintang Ula |
| **360° Web VR Tour** | `vr.museumanatomi.ub.ac.id` | **Aditya** |
| Dynamic Web AR | `ar.museumanatomi.ub.ac.id` | Azarya |
| Multimedia App | — | Belva |
| Backend / API / DB | — | Azkal / Akmal |

---

*Developed by MGM Lab (Multimedia & Game Technology) — Faculty of Computer Science, Universitas Brawijaya*
