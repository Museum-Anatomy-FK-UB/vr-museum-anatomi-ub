'use client';

import { useEffect, useRef } from 'react';
import type { Hotspot } from '@/lib/types/tour';

/** Konversi yaw/pitch (derajat) ke posisi 3D pada bola dengan radius tertentu. */
function toPosition(yaw: number, pitch: number, radius = 6): string {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const x = radius * Math.cos(p) * Math.sin(y);
  const height = radius * Math.sin(p);
  const z = -radius * Math.cos(p) * Math.cos(y);
  return `${x.toFixed(2)} ${height.toFixed(2)} ${z.toFixed(2)}`;
}

const COLOR = {
  navigation: '#38bdf8',
  info: '#fbbf24',
} as const;

function HotspotEntity({ hotspot, onActivate }: { hotspot: Hotspot; onActivate: () => void }) {
  const ref = useRef<HTMLElement>(null);

  // A-Frame cursor memancarkan event 'click' (gaze/mouse) pada entity target.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onActivate();
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onActivate]);

  return (
    <a-entity
      ref={ref}
      class="clickable"
      position={toPosition(hotspot.yaw, hotspot.pitch)}
      rotation={`0 ${-hotspot.yaw} 0`}
    >
      <a-circle
        radius="0.35"
        material={`shader: flat; side: double; color: ${COLOR[hotspot.type]}; opacity: 0.92`}
        animation__pulse="property: scale; dir: alternate; dur: 900; loop: true; to: 1.15 1.15 1.15"
      />
      <a-text
        value={hotspot.label}
        align="center"
        position="0 0.7 0"
        width="6"
        color="#ffffff"
      />
    </a-entity>
  );
}

export default function HotspotLayer({
  hotspots,
  onNavigate,
  onInfo,
}: {
  hotspots: Hotspot[];
  onNavigate: (targetSceneId: string) => void;
  onInfo: (collectionId: string) => void;
}) {
  return (
    <>
      {hotspots.map((hotspot) => (
        <HotspotEntity
          key={hotspot.id}
          hotspot={hotspot}
          onActivate={() =>
            hotspot.type === 'navigation'
              ? onNavigate(hotspot.target_scene_id)
              : onInfo(hotspot.collection_id)
          }
        />
      ))}
    </>
  );
}
