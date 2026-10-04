/**
 * requestAnimationFrame loop with a delta time in seconds. dt is capped so a
 * backgrounded tab doesn't jump the game forward. Returns a stop function,
 * which is safe to call from inside the tick.
 */
export function frameLoop(tick: (dt: number) => void, maxDt = 0.1): () => void {
  let last = performance.now();
  let stopped = false;
  let raf = requestAnimationFrame(function frame(now) {
    if (stopped) return;
    const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    if (!stopped) raf = requestAnimationFrame(frame);
  });
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
