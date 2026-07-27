# public/panorama — 360° photos for local testing

Put 360° photos here for **local testing** (temporary, before the real assets
are served from the server storage via the API — see `docs/API.md`).

Files in this folder are reachable from the root URL, e.g.:

```
public/panorama/lobby.jpg   →   http://localhost:3000/panorama/lobby.jpg
```

## Image requirements

- **Equirectangular format** (spherical projection), **2:1 ratio** (e.g. 4096×2048,
  8192×4096). If it's not 2:1, the panorama will look stretched/skewed.
- File format: `.jpg` (recommended) or `.png`.
- Cross-device-safe resolution: width **≤ 8192px** (many phones/GPUs cap texture
  size at 4096–8192). When in doubt, use 4096×2048.

## How to use

Data (including `panorama_url`) now comes live from the backend API — there is
no local mock layer anymore. This folder is only useful if you need to point a
room's `panorama_url` at a local file for one-off testing (e.g. the backend
team hasn't uploaded a photo yet): put the file here, then set that scene's
`panorama_url` in the backend/CMS to the local path, e.g.:

```
http://localhost:3000/panorama/lobby.jpg
```

> Note: image files are **not committed** to Git (ignored). Only this folder +
> README are tracked. Production assets are served from the server storage, not the repo.

