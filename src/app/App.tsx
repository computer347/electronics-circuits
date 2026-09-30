import { DeskView } from '../desk/DeskView';
import { useDesk } from '../desk/store';
import { RepairBench } from '../repair/RepairBench';
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
  const choose = (c: FrontChoice) => {
    if (c === 'workshop') { go('workshop'); return; }
    const startOn = c === 'play' ? 'map' : c === 'learn' ? 'theory' : c === 'practice' ? 'practice' : null;
    useDesk.setState({ startOn });
    go('desk');
  };
  if (screen === 'workshop') return <Workshop onBack={() => go('home')} onOpen={(c) => c.open && go(c.open.screen, c.open.job)} />;
  if (screen === 'repair' && job) return <RepairBench jobId={job} onExit={() => go('workshop')} />;
  if (screen === 'desk') return <DeskView onMenu={() => { useDesk.getState().leave(); go('home'); }} />;
  return <FrontPage onChoose={choose} />;
}
