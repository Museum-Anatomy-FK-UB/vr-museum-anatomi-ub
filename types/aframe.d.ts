// A-Frame element declarations so they can be used as JSX in TSX.
// A-Frame registers custom elements (<a-scene>, <a-sky>, etc.) at runtime;
// TypeScript doesn't know these tags without the declarations below.
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
      'a-triangle': AFrameElement;
      'a-image': AFrameElement;
      'a-plane': AFrameElement;
      'a-assets': AFrameElement;
      'a-asset-item': AFrameElement;
    }
  }
}

export {};
