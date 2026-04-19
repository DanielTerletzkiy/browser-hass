import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';

import { version } from '../../public/manifest.json';
import { Connection, Options } from '../types.ts';
import { ClientConnectionListener } from '../listener.ts';
import { GetStatusColor } from '../utils.ts';
import OptionsForm from './components/OptionsForm.tsx';

const div = document.getElementById('app') || document.createElement('div');
if (!div.id) {
  div.id = 'app';
  document.body.appendChild(div);
}

let initialOptions: Omit<Options, 'accessToken'> | null = null;
chrome.storage.local.get(['options'], ({ options }: { options: Options }) => {
  initialOptions = options;
  const root = createRoot(div);
  root.render(<Entrypoint />);
});

function Entrypoint() {
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [status, setStatus] = useState<Connection | null>(null);

  useEffect(() => {
    ClientConnectionListener(setStatus);
  }, []);

  return (
    <main>
      <span id={'app-header'}>
        <h1>Browser Hass</h1> <i>v{version}</i>
      </span>
      <div
        id={'connection-status'}
        style={{
          color: GetStatusColor(status?.status ?? 'unknown'),
        }}
      >
        <strong>Status:</strong> {status?.status ?? 'unknown'}
        {status?.message && <div>{status.message}</div>}
      </div>

      {settingsVisible && <OptionsForm initialOptions={initialOptions} />}

      <button onClick={() => setSettingsVisible(!settingsVisible)}>
        {settingsVisible ? 'Hide' : 'Show'} Settings
      </button>
    </main>
  );
}
