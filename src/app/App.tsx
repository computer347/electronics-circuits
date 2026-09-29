import { DeskView } from '../desk/DeskView';
import { useDesk } from '../desk/store';
import { FrontPage, type FrontChoice } from './FrontPage';
import { useNav } from './nav';

/**
 * Two screens: the riso front page, and the lab bench where the game is played. Every choice
 * on the front page opens the bench somewhere: Continue at the next level, Play on the level
 * map, Learn in the notebook's Theory, Practice on its practice page.
 */
export function App() {
  const screen = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const choose = (c: FrontChoice) => {
    const startOn = c === 'play' ? 'map' : c === 'learn' ? 'theory' : c === 'practice' ? 'practice' : null;
    useDesk.setState({ startOn });
    go('desk');
  };
  if (screen === 'desk') return <DeskView onMenu={() => { useDesk.getState().leave(); go('home'); }} />;
  return <FrontPage onChoose={choose} />;
}
