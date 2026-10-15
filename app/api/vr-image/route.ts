// Same-origin pass-through for collection photos shown INSIDE the headset.
//
// In VR a photo becomes a WebGL texture, and the browser only allows that for
// a cross-origin image whose server sends CORS headers. When the backend's
// storage doesn't, the headset can't show the photo at all (the 2D <img> panel
// is unaffected — an <img> needs no CORS). Served from our own origin, the
// photo needs no CORS. See loadVrImage() in components/vr/VRPanels.tsx,
// which tries this only after the image optimizer and a direct load fail.
//
// Not an open proxy: only the backend's own hosts (from the env) are fetched,
// only images are passed on, and the size is capped.

const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 20000;

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const value of [process.env.NEXT_PUBLIC_API_BASE_URL, process.env.NEXT_PUBLIC_STORAGE_URL, ...(process.env.VR_IMAGE_HOSTS ?? '').split(',')]) {
    const v = value?.trim();
    if (!v) continue;
    try {
      hosts.add(new URL(v.includes('://') ? v : `https://${v}`).host);
    } catch {
      // ignore malformed entries
    }
  }
  return hosts;
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('url');
  let target: URL;
  try {
    target = new URL(raw ?? '');
  } catch {
    return new Response('Bad url', { status: 400 });
  }
  if ((target.protocol !== 'https:' && target.protocol !== 'http:') || !allowedHosts().has(target.host)) {
    return new Response('Host not allowed', { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch {
    return new Response('Upstream unreachable', { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response('Upstream error', { status: 502 });

  // Some storage servers label images as a generic binary — accept those too
  // when the file name says image; anything else (HTML error pages…) is refused.
  const type = upstream.headers.get('content-type') ?? '';
  const looksLikeImage = /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(target.pathname);
  if (!type.startsWith('image/') && !(looksLikeImage && /octet-stream|^$/.test(type))) {
    return new Response('Not an image', { status: 415 });
  }
  const length = Number(upstream.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return new Response('Too large', { status: 413 });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': type.startsWith('image/') ? type : 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
