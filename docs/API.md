# API Contract — 360° Web VR Tour

Draft of the endpoints the Web VR needs. This document was written by the VR team
as a **proposal to the Backend team (Azkal / Akmal)** to be reviewed and
implemented.

> **Status:** Draft — not final, needs alignment with the Backend team.

---

## Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:8000/api` |
| Production | `https://museumanatomi.ub.ac.id/api` |

Configured via `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

---

## 1. `GET /api/vr/scenes`

Returns the list of all rooms available for the VR Tour.
Used on the `/vr` landing page and on the floor plan overlay.

**Response:**
```json
{
  "data": [
    {
      "id": "ruang-lobby",
      "title": "Lobby Museum",
      "thumbnail_url": "/storage/thumbs/lobby.jpg",
      "order": 1,
      "map_x": 50,
      "map_y": 82
    },
    {
      "id": "ruang-osteologi",
      "title": "Ruang Osteologi",
      "thumbnail_url": "/storage/thumbs/osteologi.jpg",
      "order": 2,
      "map_x": 24,
      "map_y": 48
    }
  ]
}
```

> `map_x` / `map_y` are the room's position on the museum floor plan, as a
> percentage (0–100) of the floor plan image's width/height. Optional, but
> strongly recommended — a scene without them simply won't get a pin on the
> floor plan overlay (the frontend already handles a missing value
> gracefully). See **Field Reference** below and the note in
> **Pending / To Discuss**.

---

## 2. `GET /api/vr/scenes/:sceneId`

Returns the detail of a single scene along with all its hotspots.
Used when the user opens `/vr/[sceneId]`.

**Response:**
```json
{
  "data": {
    "id": "ruang-osteologi",
    "title": "Ruang Osteologi",
    "panorama_url": "/storage/360/osteologi.jpg",
    "thumbnail_url": "/storage/thumbs/osteologi.jpg",
    "initial_yaw": 0,
    "initial_pitch": 0,
    "hotspots": [
      {
        "id": "hs-001",
        "type": "navigation",
        "yaw": 90,
        "pitch": 0,
        "label": "Ruang Organ Dalam",
        "arrow": "right",
        "target_scene_id": "ruang-organ-dalam"
      },
      {
        "id": "hs-002",
        "type": "info",
        "yaw": -30,
        "pitch": -10,
        "label": "Tengkorak Manusia",
        "collection_id": "skull-001"
      }
    ]
  }
}
```

**`hotspot.type` field:**
- `navigation` — moves to another room (`target_scene_id` is required)
- `info` — opens the collection info panel (`collection_id` is required, `arrow` is not used)

**Hotspot position fields:**
- `yaw` — horizontal rotation in degrees (-180 to 180)
- `pitch` — vertical rotation in degrees (-90 to 90)

**`hotspot.arrow` field** (navigation hotspots only, optional): direction the
arrow icon points — one of `up`, `down`, `left`, `right`. Defaults to `up` if
omitted. Chosen by whoever places the hotspot to visually match the direction
of the target room.

---

## 3. `GET /api/collections/:id`

Returns the detail of a single collection item. Called when the user clicks an
`info` hotspot. This data is the **same** as the one used by the Web Portal and
the Multimedia App (single source of truth, no duplication).

**Response:**
```json
{
  "data": {
    "id": "skull-001",
    "name": "Tengkorak Manusia",
    "latin_name": "Cranium",
    "category": "Sistem Rangka",
    "description": "Tengkorak manusia tersusun atas 22 tulang...",
    "photos": [
      {
        "url": "/storage/collections/skull-001-1.jpg",
        "caption": "Tampak depan"
      }
    ],
    "audio_url": "/storage/audio/skull-001.mp3",
    "video_url": null,
    "portal_url": "https://museumanatomi.ub.ac.id/koleksi/skull-001"
  }
}
```

> Note: example values (names, descriptions, captions) are shown in Indonesian
> because that's the actual content language the API will serve.

---

## Field Reference

Backend should validate CMS input against these constraints before saving —
the VR scene has no server-side validation of its own, so bad data (out-of-range
angles, dangling IDs) will render incorrectly or silently break a hotspot.

### SceneSummary (`GET /api/vr/scenes` list items)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable slug, used in the URL (`/vr/:id`) |
| `title` | string | yes | Room name shown on cards & floor plan |
| `thumbnail_url` | string (URL) | yes | Small image for landing cards, not the full 360° photo |
| `order` | number | yes | Display order in the room list |
| `map_x` | number (0–100) | no | Horizontal % position on the floor plan image. Omitting it just hides this room's pin on the floor plan — no error |
| `map_y` | number (0–100) | no | Vertical % position on the floor plan image. Same as `map_x` |

### Scene (`GET /api/vr/scenes/:sceneId`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id`, `title`, `thumbnail_url` | — | yes | Same as SceneSummary |
| `order` | number | no | Accepted by the frontend type but **not read anywhere at the detail level** — only `SceneSummary.order` (from the list endpoint) is actually used, for the floor plan pin label |
| `panorama_url` | string (URL) | yes | Full-resolution equirectangular 360° photo |
| `initial_yaw` | number (-180 to 180) | yes | Camera's starting horizontal angle when the room loads |
| `initial_pitch` | number (-90 to 90) | yes (per current frontend type) | **Not read by any current rendering logic** — camera always starts level regardless of this value. Reserved for a future vertical-start-angle feature; safe to always send `0` |
| `hotspots` | array | yes | Can be empty `[]` |

### Hotspot

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within the scene |
| `type` | `"navigation"` \| `"info"` | yes | |
| `yaw` | number (-180 to 180) | yes | |
| `pitch` | number (-90 to 90) | yes | |
| `label` | string | yes | Shown as a text caption above the hotspot |
| `arrow` | `"up"` \| `"down"` \| `"left"` \| `"right"` | no | Navigation only (ignored for `info`); defaults to `up` if omitted |
| `target_scene_id` | string | required if `type: navigation` | Must match an existing `Scene.id` — see referential integrity note below |
| `collection_id` | string | required if `type: info` | Must match an existing `Collection.id` |

### Collection (`GET /api/collections/:id`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match `hotspot.collection_id` referencing it |
| `name` | string | yes | |
| `latin_name` | string | no | |
| `category` | string | no | |
| `description` | string | yes | |
| `photos` | array of `{ url, caption? }` | yes | Can be empty `[]` |
| `audio_url` | string (URL) or `null` | no | Voice-over narration |
| `video_url` | string (URL) or `null` | no | Accepted by the frontend type but **there is no video player in the UI yet** — reserved for a future feature, safe to always send `null` for now |
| `portal_url` | string (URL) | no | Link to the matching Web Portal page |

---

## Proposed Database Schema

A draft ER diagram translating the **Field Reference** above into tables
(`scenes`, `hotspots`, `collections`, `collection_photos`) is available here:

**[dbdiagram.io/d/6a5b62c0067336e1dea2954d](https://dbdiagram.io/d/6a5b62c0067336e1dea2954d)**

> This is a proposal from the VR team for discussion, not a final schema —
> the Backend team owns the actual database design and implementation. In
> particular, `scenes`/`collections` use a `varchar` slug as primary key to
> match the `id` values already used across the API contract above; swap to
> a surrogate integer key + separate slug column if that fits the Backend
> team's conventions better. Make sure link sharing is enabled on the
> diagram so the Backend team can open it.

---

## Content Editability & Data Flow

The VR frontend is **read-only** — it only ever calls `GET` endpoints and never
writes data. For the FK UB content team to be able to change rooms, hotspots,
or collection content, the actual editing needs to happen somewhere on the
Backend side (an admin panel or CMS that writes to the shared MySQL database).
That editing UI is out of scope for this repo; the VR team just needs to know:

1. **Who builds the editing UI for the FK UB team?** — Backend team's admin
   panel, or the Portal (WordPress) team's dashboard? This doesn't change the
   API contract above, but affects who the VR team should sync validation
   rules with.

2. **Server-side validation is required**, since edits will come from
   non-developer staff, not from a controlled seed script. At minimum: `yaw`/
   `pitch` ranges, required-field-per-hotspot-type rules, and referential
   integrity (see below) should be enforced when a scene/hotspot is saved —
   not left for the frontend to catch.

3. **Referential integrity**: if a hotspot's `target_scene_id` or
   `collection_id` is deleted or mistyped in the CMS, what should happen?
   Two options to discuss with Backend:
   - Backend validates on save and rejects the edit (preferred — keeps bad
     data out of the database entirely).
   - Backend allows it, and the VR frontend skips/hides any hotspot whose
     reference doesn't resolve, instead of crashing the scene.

4. **How "live" do edits need to feel?** The frontend currently uses SWR with
   default settings — no polling interval, so it only re-fetches on window
   focus or reconnect. In practice: an edit made by the FK UB team will show
   up for a visitor the next time they load `/vr` or return to the tab, not
   instantly. If that's too slow (e.g. content team wants to preview a change
   live), the VR team can add a `refreshInterval` — let us know if that's
   needed.

---

## Notes for the Backend Team

1. **CORS** — `panorama_url` and all asset URLs must be absolute URLs or paths
   reachable from the VR domain (`vr.museumanatomi.ub.ac.id`). This needs CORS
   configuration on the server.

2. **Caching** — The `/api/vr/scenes` endpoint should be cached aggressively
   since it's called every time the landing page opens. Per the coordinator's
   direction (proposal slide 18): avoid loading the server directly — use data
   mirroring/views.

3. **Data consistency** — `collection_id` in a hotspot must reference the same
   `id` in the collection table used by the Web Portal and Multimedia. There must
   not be a separate collection table just for VR.

4. **Parallel development** — Until these endpoints are ready, the VR team uses
   local mock data in `lib/mock/`. Once the endpoints are live, we just switch
   `NEXT_PUBLIC_API_BASE_URL` and the functions in `lib/api.ts`.

5. **Error handling** — Please be consistent: use the correct HTTP status codes
   for error responses (404 for scene/collection not found, 500 for server
   error) with a body of `{ "message": "..." }`.

---

## Pending / To Discuss

- [ ] Do we need an endpoint for collections per category (a gallery per room)?
- [ ] `audio_url` format — is there also a text transcript of the voice-over?
- [ ] Does `panorama_url` need multi-resolution variants (tiling) for very
      high-resolution photos? (waiting on the final photo resolution from FK)
- [ ] Authentication scheme if there will be FK-student-only content later.
- [ ] Who owns/builds the CMS editing UI for the FK UB content team — Backend
      or Portal? (see **Content Editability & Data Flow** above)
- [ ] Referential integrity on delete/rename of a scene or collection that's
      still referenced by a hotspot — reject on save, or let the frontend
      handle a broken reference gracefully?
- [ ] Is SWR's default revalidate-on-focus refresh fast enough for the content
      team's workflow, or do we need polling?
