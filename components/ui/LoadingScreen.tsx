export default function LoadingScreen({ message = 'Memuat…' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-200">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-brand-light"
        aria-hidden
      />
      <p className="text-sm tracking-wide">{message}</p>
    </div>
  );
}
