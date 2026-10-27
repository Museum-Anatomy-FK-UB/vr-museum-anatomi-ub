# public/panorama — 360° photos and logos

What lives here:

- `kompress/` — **compressed** panoramas (5760×2880, roughly 0.7–2.7 MB each) for the
  local preview (`NEXT_PUBLIC_LOCAL_PREVIEW=true`, see `lib/localPreviewData.ts`).
  This folder **is committed** to Git (see the exception in `.gitignore`).
- `logo/` — the UB and FK UB logos used by the UI.
- Anything else here (e.g. `scenes/`, `lobby/` with the original high-resolution
  photos) is **not committed** — keep it local only.

In the live tour, panoramas come from the URLs the backend API returns
(`panorama_url`), not from this folder.

Files in this folder are reachable from the root URL, e.g.:

```
public/panorama/kompress/lobby.JPG   →   http://localhost:3000/panorama/kompress/lobby.JPG
```

## Image requirements

- **Equirectangular format** (spherical projection), **2:1 ratio** (e.g. 4096×2048,
  8192×4096). If it's not 2:1, the panorama will look stretched/skewed.
- File format: `.jpg` (recommended) or `.png`.
- Cross-device-safe resolution: width **≤ 8192px** (many phones/GPUs cap texture
  size at 4096–8192). When in doubt, use 4096×2048.
- Panoramas load into WebGL, so whatever server hosts them must send CORS
  headers (see the "VR Headsets" section of the main README).

## Testing a single room locally

To point one room at a local file without touching the rest (e.g. the backend
team hasn't uploaded a photo yet), put the file here and set that scene's
`panorama_url` in the backend/CMS to the local path, e.g.:

```
http://localhost:3000/panorama/lobby.jpg
```
