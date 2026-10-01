import { lazy, Suspense, useEffect, useState } from 'react';
import { clientJobById } from '../jobs/client';
import { useClient } from '../jobs/store';
import { useDesk } from '../desk/store';
import { FrontPage, type FrontChoice } from './FrontPage';
import { useNav } from './nav';

// Every screen but the front page loads when it's first opened (three.js and the 3D models
// with it), so the front page comes up fast. The desk is fetched in the background as soon as
// the front page is idle, so Continue is instant.
const loadDesk = () => import('../desk/DeskView');
const DeskView = lazy(() => loadDesk().then((m) => ({ default: m.DeskView })));
const Workshop = lazy(() => import('./Workshop').then((m) => ({ default: m.Workshop })));
const LabBench = lazy(() => import('../lab/LabBench').then((m) => ({ default: m.LabBench })));
const RepairBench = lazy(() => import('../repair/RepairBench').then((m) => ({ default: m.RepairBench })));
const CodingBench = lazy(() => import('../coding/CodingBench').then((m) => ({ default: m.CodingBench })));
const WiringBench = lazy(() => import('../wiring/WiringBench').then((m) => ({ default: m.WiringBench })));
const ClientIntro = lazy(() => import('../jobs/ClientScene').then((m) => ({ default: m.ClientIntro })));
const ClientOverlay = lazy(() => import('../jobs/ClientScene').then((m) => ({ default: m.ClientOverlay })));
const CareerPage = lazy(() => import('../business/CareerPage').then((m) => ({ default: m.CareerPage })));
const ShopPage = lazy(() => import('../business/ShopPage').then((m) => ({ default: m.ShopPage })));
const AchievementToast = lazy(() => import('../business/AchievementToast'));

/** What shows for the moment a screen's code is still loading. */
function Loading() {
  return <div className="screen-loading" role="status"><span>Loading…</span></div>;
}

export function App() {
  const screen = useNav((s) => s.screen);
  return (
    <>
      <Suspense fallback={<Loading />}><Screens /></Suspense>
      {screen !== 'home' && screen !== 'workshop' && screen !== 'career' && screen !== 'shop' && <RotateTip />}
      <Suspense fallback={null}><AchievementToast /></Suspense>
    </>
  );
}

const TIP_KEY = 'signal-path.rotate-tip.v1';
/** On a phone held upright (CSS decides), a one-line tip to turn it sideways for the 3D benches. */
function RotateTip() {
  const [gone, setGone] = useState(() => { try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return false; } });
  if (gone) return null;
  const close = () => { setGone(true); try { localStorage.setItem(TIP_KEY, '1'); } catch { /* private mode */ } };
  return <div className="rotate-tip" role="note">↻ Turn your phone sideways for the bench <button onClick={close}>OK</button></div>;
}

/**
 * The riso front page, the lab bench where the campaign is played, and the workshop with its
 * own benches. Continue, Play, Learn and Practice open the desk somewhere (the next level, the
 * level map, the notebook's Theory, its practice page); Workshop opens the activity jobs.
 */
function Screens() {
  const screen = useNav((s) => s.screen);
  const job = useNav((s) => s.job);
  const go = useNav((s) => s.go);
  const clientOn = useClient((s) => !!s.job);
  useEffect(() => {
    if (screen !== 'home') return;
    const idle = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1200));
    idle(() => { void loadDesk(); });
  }, [screen]);
  const train = (levelId: string) => { useDesk.setState({ startOn: null }); useDesk.getState().enter(levelId); go('desk'); };
  const choose = (c: FrontChoice) => {
    if (c === 'workshop') { go('workshop'); return; }
    if (c === 'career') { go('career'); return; }
    const startOn = c === 'play' ? 'map' : c === 'learn' ? 'theory' : c === 'practice' ? 'practice' : null;
    useDesk.setState({ startOn });
    go('desk');
  };
  if (screen === 'career') return <CareerPage onBack={() => go('home')} onShop={() => go('shop')} onTrain={train} />;
  if (screen === 'shop') return <ShopPage onBack={() => go('home')} onCareer={() => go('career')} />;
  if (screen === 'workshop') return <Workshop onBack={() => go('home')} onOpen={(c) => c.open && go(c.open.screen, c.open.job)} onLab={(p) => go('lab', p)} />;
  if (screen === 'lab' && job) return <LabBench key={job} part={job} onExit={() => go('workshop')} onNext={(p) => go('lab', p)} />;
  if (screen === 'repair' && job) return <RepairBench key={job} jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'coding' && job) return <CodingBench key={job} jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'wiring' && job) return <WiringBench key={job} jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'client' && job) {
    const cj = clientJobById(job);
    if (cj) return <ClientIntro job={cj} onBack={() => go('workshop')} onTake={() => {
      useClient.getState().begin(cj);
      useClient.getState().work();
      useDesk.setState({ startOn: null });
      useDesk.getState().enter(cj.levelId);
      go('desk');
    }} />;
  }
  if (screen === 'desk') return (
    <>
      <DeskView onMenu={() => { useDesk.getState().leave(); const onJob = !!useClient.getState().job; useClient.getState().clear(); go(onJob ? 'workshop' : 'home'); }} />
      {clientOn && <ClientOverlay onFinished={() => { useClient.getState().clear(); useDesk.getState().leave(); go('workshop'); }} />}
    </>
  );
  return <FrontPage onChoose={choose} />;
}
