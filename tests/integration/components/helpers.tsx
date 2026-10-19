// Shared jsdom helpers for component integration tests (not a test file).
import { render } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import type { ReactElement } from "react";
import { vi } from "vitest";

/** Reduced motion everywhere, including inner <MotionConfig reducedMotion="user">. */
export function stubBrowser() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!("IntersectionObserver" in window)) {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
  // jsdom 26 has no Blob#text(); every browser the app supports does
  if (typeof Blob.prototype.text !== "function") {
    Blob.prototype.text = function text(this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
}

export function renderCalm(ui: ReactElement) {
  return render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);
}

/** Every element styled as the red primary action. */
export function primaries(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".btn-primary"));
}
