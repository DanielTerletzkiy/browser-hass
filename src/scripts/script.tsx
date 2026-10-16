import { createRoot } from 'react-dom/client';
import { useState } from 'react';

import { version } from '../../public/manifest.json';
import { Connection, Options, Registration } from '../types.ts';
import { NormalizeUrl } from '../utils.ts';
import ConnectionForm from '../popup/ConnectionForm.tsx';
import Overview from '../popup/Overview.tsx';
import { Icon } from '../popup/icons.tsx';
import { useStorage } from '../popup/hooks.ts';

const div = document.getElementById('app') || document.createElement('div');
if (!div.id) {
  div.id = 'app';
  document.body.appendChild(div);
}
createRoot(div).render(<Popup />);

function Popup() {
  const options = useStorage<Options>('options');
  const connection = useStorage<Connection>('connection');
  const registration = useStorage<Registration>('registration');
  const deviceId = useStorage<string>('deviceId');
  const [editing, setEditing] = useState(false);

  // Avoid flashing the setup form while storage loads
  if (options === undefined) return null;

  const baseUrl = options?.url ? NormalizeUrl(options.url) : null;
  const configured = !!baseUrl && !!options?.accessToken;

  return (
    <main>
      <header className="app-header">
        {editing ? (
          <button
            className="icon-button"
            title="Back"
            onClick={() => setEditing(false)}
          >
            <Icon name="back" />
          </button>
        ) : (
          <img src="images/icon-48x48.png" alt="" width={28} height={28} />
        )}
        <h1>Browser HASS</h1>
        <span className="version">v{version}</span>
        {configured && !editing && (
          <button
            className="icon-button"
            title="Connection settings"
            onClick={() => setEditing(true)}
          >
            <Icon name="cog" />
          </button>
        )}
      </header>

      {!configured || editing ? (
        <ConnectionForm
          options={options}
          onDone={configured ? () => setEditing(false) : undefined}
        />
      ) : (
        <Overview
          baseUrl={baseUrl}
          connection={connection ?? null}
          registration={registration ?? null}
          deviceId={deviceId ?? null}
          onEdit={() => setEditing(true)}
        />
      )}
    </main>
  );
}
