'use client';

// Footer control bar ala 3DVista/FILKOM: Main Location, All Location,
// Toggle Fullscreen, Show/Hide Hotspot. Ikon = inline SVG (tanpa dependency baru).

const ICON = 'h-5 w-5';

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M3 21h18M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M9 8h1M9 12h1M12 8h1M12 12h1M16 21V11h3a1 1 0 0 1 1 1v9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A9.8 9.8 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3-.5" />
    </svg>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex w-[76px] flex-col items-center gap-1 rounded-lg px-2 py-2 text-white/90 transition hover:bg-white/15 hover:text-white"
    >
      {children}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

export default function SceneControlsBar({
  onMainLocation,
  onOpenGallery,
  onToggleFullscreen,
  hotspotsVisible,
  onToggleHotspots,
}: {
  onMainLocation: () => void;
  onOpenGallery: () => void;
  onToggleFullscreen: () => void;
  hotspotsVisible: boolean;
  onToggleHotspots: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-black/55 px-2 py-1.5 shadow-lg backdrop-blur">
        <ControlButton label="Main Location" onClick={onMainLocation}>
          <BuildingIcon />
        </ControlButton>
        <ControlButton label="All Location" onClick={onOpenGallery}>
          <GridIcon />
        </ControlButton>
        <ControlButton label="Fullscreen" onClick={onToggleFullscreen}>
          <FullscreenIcon />
        </ControlButton>
        <ControlButton
          label={hotspotsVisible ? 'Hide Hotspot' : 'Show Hotspot'}
          onClick={onToggleHotspots}
        >
          {hotspotsVisible ? <EyeIcon /> : <EyeOffIcon />}
        </ControlButton>
      </div>
    </div>
  );
}
