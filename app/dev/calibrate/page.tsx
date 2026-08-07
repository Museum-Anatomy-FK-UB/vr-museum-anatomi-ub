'use client';

import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Dev-only hotspot calibration tool — see components/dev/CalibrationTool.tsx.
// 404s outside development so it never ships to production.
const CalibrationTool = dynamic(() => import('@/components/dev/CalibrationTool'), {
  ssr: false,
  loading: () => <LoadingScreen message="Menyiapkan kalibrasi…" />,
});

export default function CalibratePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <CalibrationTool />;
}
