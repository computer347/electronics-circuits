/**
 * The music control: a small pill in the corner of every screen. Play or pause, skip to the
 * next track, set the volume. If the music was left on, it starts with the first click or key
 * press (browsers won't play sound before one).
 */
import { useEffect, useState } from 'react';
import { music, type MusicState } from './engine';
import { TRACKS } from './jazz';
import './music.css';

export default function MusicControl() {
  const [s, setS] = useState<MusicState>(music.state);
  const [open, setOpen] = useState(false);
  useEffect(() => music.subscribe(setS), []);
  useEffect(() => {
    if (!music.state.on) return;
    const start = () => { if (music.state.on && !music.state.playing) music.play(); off(); };
    const off = () => { removeEventListener('pointerdown', start); removeEventListener('keydown', start); };
    addEventListener('pointerdown', start);
    addEventListener('keydown', start);
    return off;
  }, []);
  const name = TRACKS[s.track]?.name ?? '';
  return (
    <div className={`music ${open ? 'open' : ''} ${s.playing ? 'on' : ''}`} onMouseLeave={() => setOpen(false)}>
      <button className="music-play" onClick={() => music.toggle()} onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)}
        aria-label={s.playing ? 'Pause the music' : 'Play the music'} title={s.playing ? 'Pause the music' : 'Play some soft jazz'}>
        {s.playing ? <span className="music-bars" aria-hidden><i /><i /><i /></span> : '♪'}
      </button>
      {open && (
        <>
          <span className="music-name" aria-live="polite" title="Instruments: FluidR3 GM by Frank Wen (CC BY 3.0)">{s.playing ? `${name}${s.loading ? ' · loading…' : ''}` : 'Music off'}</span>
          <button className="music-next" onClick={() => music.next()} aria-label="Next track" title="Next track">⏭</button>
          <input className="music-vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => music.setVolume(Number(e.target.value))} aria-label="Music volume" />
        </>
      )}
    </div>
  );
}
