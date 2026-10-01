/**
 * Watches progress, the wallet and the business, and pops a toast when an achievement is
 * newly earned, anywhere in the game. Ones already earned before this session are recorded
 * quietly on the first look, so opening the game doesn't replay them.
 */
import { useEffect, useRef, useState } from 'react';
import './business.css';
import { ACHIEVEMENTS } from './career';
import { useCareerInput } from './CareerPage';
import { useBusiness } from './store';

export default function AchievementToast() {
  const input = useCareerInput();
  const first = useRef(true);
  const [shown, setShown] = useState<{ id: string; key: number } | null>(null);
  useEffect(() => {
    const got = ACHIEVEMENTS.filter((a) => a.got(input)).map((a) => a.id);
    const fresh = useBusiness.getState().award(got);
    if (first.current) { first.current = false; return; }
    if (fresh.length) setShown({ id: fresh[0]!, key: Date.now() });
  }, [input]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 4600);
    return () => clearTimeout(t);
  }, [shown]);
  const a = shown && ACHIEVEMENTS.find((x) => x.id === shown.id);
  if (!a) return null;
  return (
    <div key={shown.key} className="biz-toast" role="status">
      <small>Achievement</small>
      <b>{a.name}</b>
      <span>{a.what}</span>
    </div>
  );
}
