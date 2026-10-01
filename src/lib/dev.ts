/**
 * Dev tool: play any level whatever the progress. Open the app once with ?unlock and it stays on
 * (saved in this browser); ?unlock=0 turns it off again. Progress is still recorded as usual.
 */
const KEY = 'signal-path.dev.unlock';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('unlock');
    if (q !== null) {
      if (q === '0' || q === 'off') localStorage.removeItem(KEY); else localStorage.setItem(KEY, '1');
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Every level open (dev only). Read once at start-up. */
export const devUnlockAll = read();
