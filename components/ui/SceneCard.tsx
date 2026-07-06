import Link from 'next/link';
import type { SceneSummary } from '@/lib/types/tour';

export default function SceneCard({ scene }: { scene: SceneSummary }) {
  return (
    <Link
      href={`/vr/${scene.id}`}
      className="group block overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="aspect-[3/2] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scene.thumbnail_url}
          alt={scene.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex items-center justify-between p-4">
        <h3 className="font-medium text-neutral-800">{scene.title}</h3>
        <span className="text-sm text-brand transition group-hover:translate-x-0.5">Masuk →</span>
      </div>
    </Link>
  );
}
