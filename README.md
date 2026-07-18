# vr-museum-anatomi-ub

360° Web Virtual Museum — part of the Digital Ecosystem of the Anatomy Museum, Faculty of Medicine, Universitas Brawijaya.

This app lets users explore every room of the FK UB Anatomy Museum virtually through the browser, anytime and anywhere, without visiting the physical location. Interactive hotspots surface anatomy collection information pulled dynamically from the ecosystem's centralized database.

> **Status:** In development — an interactive proof-of-concept is built (mock-data driven); pending the real backend API and production assets.
> **PIC:** Anak Agung Ngurah Aditya Wirayudha
> **Part of:** [Digital Ecosystem of the FK UB Anatomy Museum](https://museumanatomi.ub.ac.id) — MGM Lab, FILKOM UB

---

## Key Features

- Multi-room 360° virtual tour (Lobby, Basic Anatomy, Osteology, Internal Organs, Histology, Embryology)
- Room-to-room navigation via hotspots and a museum floor plan / map
- Collection info hotspots — photos, description, voice-over, and a link to the Web Portal
- VR Mode (WebXR / Google Cardboard) via a toggle button
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
NEXT_PUBLIC_USE_MOCK=true                             # Use local mock data (lib/mock)
```

While `NEXT_PUBLIC_USE_MOCK=true` (or `NEXT_PUBLIC_API_BASE_URL` is empty), the app serves data from `lib/mock/` instead of the backend. Set it to `false` once the API is live.

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
