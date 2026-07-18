'use client';

// Button to enter VR mode (WebXR / Google Cardboard) — a mandatory proposal requirement.
// Calls the A-Frame <a-scene>'s enterVR(). A-Frame also provides a built-in button
// (goggles); this is just a clearer entry point for the user.
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
