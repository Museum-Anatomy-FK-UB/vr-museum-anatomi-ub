// Deklarasi elemen A-Frame supaya bisa dipakai sebagai JSX di TSX.
// A-Frame memasang custom element (<a-scene>, <a-sky>, dll) saat runtime;
// TypeScript tidak tahu tag ini tanpa deklarasi berikut.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type AFrameElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attr: string]: unknown;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': AFrameElement;
      'a-sky': AFrameElement;
      'a-entity': AFrameElement;
      'a-camera': AFrameElement;
      'a-cursor': AFrameElement;
      'a-text': AFrameElement;
      'a-circle': AFrameElement;
      'a-ring': AFrameElement;
      'a-image': AFrameElement;
      'a-plane': AFrameElement;
      'a-assets': AFrameElement;
      'a-asset-item': AFrameElement;
    }
  }
}

export {};
