import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@comfycomputer/agent-mascots';

function App() {
  const [pokes, setPokes] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mood, setMood] = useState<'idle' | 'working'>('idle');
  return (
    <main>
      <div id="target" ref={setTarget}>
        target
      </div>
      <agent-mascot
        id="mascot"
        shape="ghost"
        material="frost"
        mood={mood}
        size={160}
        bodyWidth={1.2}
        body-height={0.9}
        accessories={['antenna', 'ring']}
        trackElement={target}
        gyro={false}
        onmascot-poke={() => setPokes((count) => count + 1)}
      />
      <output id="pokes">{pokes}</output>
      <button id="work" onClick={() => setMood('working')}>
        work
      </button>
    </main>
  );
}

const root = document.querySelector('#root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
