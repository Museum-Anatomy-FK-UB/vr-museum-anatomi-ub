import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Virtual Museum Anatomi FK UB',
  description:
    'Tur virtual 360° Museum Anatomi Fakultas Kedokteran Universitas Brawijaya — ' +
    'jelajahi koleksi anatomi kapan saja dan di mana saja.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
