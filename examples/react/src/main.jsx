import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@comfycomputer/agent-mascots';
import './style.css';

const MOODS = ['idle', 'thinking', 'working', 'success', 'error'];

function App() {
  const [mood, setMood] = useState('idle');
  const [pokes, setPokes] = useState(0);

  return (
    <main id="stage">
      <agent-mascot
        shape="orb"
        color="#5b5bd6"
        track="#stage"
        mood={mood}
        onmascot-poke={() => setPokes((count) => count + 1)}
      />
      <nav>
        {MOODS.map((name) => (
          <button key={name} aria-pressed={name === mood} onClick={() => setMood(name)}>
            {name}
          </button>
        ))}
      </nav>
      <p>
        Pokes: <output>{pokes}</output>
      </p>
    </main>
  );
}

createRoot(document.getElementById('app')).render(<App />);
