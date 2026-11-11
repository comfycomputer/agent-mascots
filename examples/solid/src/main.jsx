import { createSignal, For } from 'solid-js';
import { render } from 'solid-js/web';
import '@comfycomputer/agent-mascots';
import './style.css';

const MOODS = ['idle', 'thinking', 'working', 'success', 'error'];

function App() {
  const [mood, setMood] = createSignal('idle');
  const [pokes, setPokes] = createSignal(0);

  return (
    <main id="stage">
      <agent-mascot
        shape="orb"
        color="#5b5bd6"
        track="#stage"
        mood={mood()}
        on:mascot-poke={() => setPokes((count) => count + 1)}
      />
      <nav>
        <For each={MOODS}>
          {(name) => (
            <button aria-pressed={name === mood()} onClick={() => setMood(name)}>
              {name}
            </button>
          )}
        </For>
      </nav>
      <p>
        Pokes: <output>{pokes()}</output>
      </p>
    </main>
  );
}

render(() => <App />, document.getElementById('app'));
