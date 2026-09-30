import { DeskView } from '../desk/DeskView';
import { clientJobById } from '../jobs/client';
import { ClientIntro, ClientOverlay } from '../jobs/ClientScene';
import { useClient } from '../jobs/store';
import { useDesk } from '../desk/store';
import { CodingBench } from '../coding/CodingBench';
import { RepairBench } from '../repair/RepairBench';
import { WiringBench } from '../wiring/WiringBench';
import { FrontPage, type FrontChoice } from './FrontPage';
import { useNav } from './nav';
import { Workshop } from './Workshop';

/**
 * The riso front page, the lab bench where the campaign is played, and the workshop with its
 * own benches. Continue, Play, Learn and Practice open the desk somewhere (the next level, the
 * level map, the notebook's Theory, its practice page); Workshop opens the activity jobs.
 */
export function App() {
  const screen = useNav((s) => s.screen);
  const job = useNav((s) => s.job);
  const go = useNav((s) => s.go);
  const clientOn = useClient((s) => !!s.job);
  const choose = (c: FrontChoice) => {
    if (c === 'workshop') { go('workshop'); return; }
    const startOn = c === 'play' ? 'map' : c === 'learn' ? 'theory' : c === 'practice' ? 'practice' : null;
    useDesk.setState({ startOn });
    go('desk');
  };
  if (screen === 'workshop') return <Workshop onBack={() => go('home')} onOpen={(c) => c.open && go(c.open.screen, c.open.job)} />;
  if (screen === 'repair' && job) return <RepairBench jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'coding' && job) return <CodingBench jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'wiring' && job) return <WiringBench jobId={job} onExit={() => go('workshop')} />;
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
