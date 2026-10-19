import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";

// Minimal in-memory Web Storage for the node environment so modules that
// touch localStorage/sessionStorage (e.g. the zustand store) can be tested
// without jsdom. jsdom provides its own implementation.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.localStorage === "undefined") g.localStorage = new MemoryStorage();
if (typeof g.sessionStorage === "undefined") g.sessionStorage = new MemoryStorage();

function resetStorage() {
  try {
    (globalThis.localStorage as Storage | undefined)?.clear();
    (globalThis.sessionStorage as Storage | undefined)?.clear();
  } catch {
    // ignore
  }
}

beforeEach(resetStorage);
afterEach(async () => {
  resetStorage();
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
