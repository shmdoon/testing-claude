/**
 * "Is a lesson video playing?" — fed by TrackedVideo (YouTube iframe API
 * postMessage events). Fallback heuristic for players without an API:
 * keyboard/mouse focus is inside a video iframe.
 */
const playing = new Set<string>();

export function setVideoPlaying(id: string, isPlaying: boolean) {
  if (isPlaying) playing.add(id);
  else playing.delete(id);
}

export function isVideoPlaying(): boolean {
  if (playing.size > 0) return true;
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  return el instanceof HTMLIFrameElement && el.dataset.video === "true";
}
