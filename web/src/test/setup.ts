import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; the theme provider reads it to detect
// the OS colour scheme. Stubbed as "no dark mode" so component tests get a
// deterministic default instead of throwing.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom implements neither the Pointer Events capture API nor scrollIntoView.
// Radix UI's Select (used throughout the app) calls both while opening and
// navigating its listbox, so without these no-op stubs every test that opens
// a <Select> throws "target.hasPointerCapture is not a function".
// https://github.com/radix-ui/primitives/issues/1822
if (typeof window !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
