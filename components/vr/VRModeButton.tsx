'use client';

// Tombol masuk mode VR (WebXR / Google Cardboard) — requirement wajib proposal.
// Memanggil enterVR() milik <a-scene> A-Frame. A-Frame juga menyediakan tombol
// bawaan (goggles), tombol ini sekadar entry point yang lebih jelas untuk user.
export default function VRModeButton() {
  const enterVR = () => {
    const scene = document.querySelector('a-scene') as (HTMLElement & { enterVR?: () => void }) | null;
    scene?.enterVR?.();
  };

  return (
    <button
      type="button"
      onClick={enterVR}
      className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-neutral-900 shadow-md backdrop-blur transition hover:bg-white"
    >
      Mode VR
    </button>
  );
}
