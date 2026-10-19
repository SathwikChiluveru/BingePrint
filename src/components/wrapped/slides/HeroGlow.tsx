/**
 * The slide glow, anchored to the hero instead of the slide. Left-aligned slides (4, 5) put the
 * hero left of center, where a full-slide glow would sit beside it. Place inside a `relative`
 * wrapper that hugs the hero, and give the hero `relative` so it paints above the glow.
 * Sized like the full-slide glow on a phone, so it reads the same as on centered slides.
 */
export function HeroGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: "min(100vw, 36rem)", height: "min(60vh, 28rem)", background: "var(--glow-hero)" }}
    />
  );
}
