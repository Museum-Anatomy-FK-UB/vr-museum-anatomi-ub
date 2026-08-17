'use client';

// Footer control bar, 3DVista/FILKOM-style: Main Location, All Location,
// Toggle Fullscreen, Show/Hide Hotspot. Icons = inline SVG (no new dependency).

const ICON = 'h-7 w-7';

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

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M9 4 3 6.2v13.6L9 17.6l6 2.2 6-2.2V6.2L15 8.4 9 6.2Z" />
      <path d="M9 4v13.6M15 8.4V22" />
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

function VrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M4 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4.2a2 2 0 0 1-1.8-1.1l-.5-1a1.7 1.7 0 0 0-3 0l-.5 1A2 2 0 0 1 8.2 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
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
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition ${
        active
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
      {/* Label appears only on hover, as a floating tooltip above the icon. */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default function SceneControlsBar({
  onMainLocation,
  onOpenGallery,
  onToggleFloorplan,
  floorplanOpen,
  onToggleFullscreen,
  onEnterVR,
  hotspotsVisible,
  onToggleHotspots,
}: {
  onMainLocation: () => void;
  onOpenGallery: () => void;
  onToggleFloorplan: () => void;
  floorplanOpen: boolean;
  onToggleFullscreen: () => void;
  onEnterVR: () => void;
  hotspotsVisible: boolean;
  onToggleHotspots: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[#161d33]/85 px-2 py-2 shadow-2xl backdrop-blur-md">
        <ControlButton label="Main Location" onClick={onMainLocation}>
          <BuildingIcon />
        </ControlButton>
        <ControlButton label="All Location" onClick={onOpenGallery}>
          <GridIcon />
        </ControlButton>
        <ControlButton label="Denah" onClick={onToggleFloorplan} active={floorplanOpen}>
          <MapIcon />
        </ControlButton>
        <ControlButton label="Fullscreen" onClick={onToggleFullscreen}>
          <FullscreenIcon />
        </ControlButton>
        <ControlButton label="Mode VR" onClick={onEnterVR}>
          <VrIcon />
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
