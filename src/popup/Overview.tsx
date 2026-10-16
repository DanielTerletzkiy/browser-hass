import { ReactNode } from 'react';

import { Connection, Registration } from '../types.ts';
import { GetStatusColor } from '../utils.ts';
import { Icon, IconName } from './icons.tsx';
import { openTab } from './hooks.ts';

const STATUS_LABEL: Record<Connection['status'], string> = {
  authenticated: 'Connected',
  connected: 'Signing in…',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Connection failed',
  unknown: 'Starting…',
};

interface OverviewProps {
  baseUrl: string;
  connection: Connection | null;
  registration: Registration | null;
  deviceId: string | null;
  onEdit: () => void;
}

export default function Overview({
  baseUrl,
  connection,
  registration,
  deviceId,
  onEdit,
}: OverviewProps) {
  const status = connection?.status ?? 'unknown';
  const online = status === 'authenticated';
  const failed = status === 'error' || status === 'disconnected';
  const host = new URL(baseUrl).host;

  return (
    <div className="stack">
      <section className="card status-card">
        <span
          className={`dot ${online ? '' : 'pulse'}`}
          style={{ color: GetStatusColor(status) }}
        />
        <div className="grow">
          <strong>{STATUS_LABEL[status]}</strong>
          <div className="muted ellipsis" title={baseUrl}>
            {failed && connection?.message ? connection.message : host}
          </div>
        </div>
        {failed && (
          <button
            className="icon-button"
            title="Reconnect"
            onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
          >
            <Icon name="refresh" />
          </button>
        )}
      </section>

      {online && (
        <RegistrationCard baseUrl={baseUrl} registration={registration} />
      )}

      {status === 'error' && connection?.message === 'Invalid access token' && (
        <Notice
          icon="alert"
          tone="error"
          title="Home Assistant rejected the token"
          action={
            <button className="button" onClick={onEdit}>
              Enter a new token
            </button>
          }
        >
          The token may have been deleted or mistyped.
        </Notice>
      )}

      {deviceId && (
        <p className="footnote">
          Device ID <code>{deviceId}</code>
        </p>
      )}
    </div>
  );
}

function RegistrationCard({
  baseUrl,
  registration,
}: {
  baseUrl: string;
  registration: Registration | null;
}) {
  const link = (path: string, label: string, primary = true) => (
    <button
      className={`button ${primary ? 'primary' : ''}`}
      onClick={() => openTab(baseUrl + path)}
    >
      {label} <Icon name="openInNew" size={16} />
    </button>
  );
  const name = registration?.name ? (
    <strong>{registration.name}</strong>
  ) : (
    'This browser'
  );

  switch (registration?.status) {
    case 'registered':
      return (
        <Notice
          icon="check"
          tone="success"
          title={<>Added as {name}</>}
          action={
            registration.device_registry_id &&
            link(
              `/config/devices/device/${registration.device_registry_id}`,
              'Open device',
              false
            )
          }
        >
          {registration.entity_id ? (
            <>
              Control it through <code>{registration.entity_id}</code>.
            </>
          ) : (
            'It is available as a media player.'
          )}{' '}
          Rename it on the device page in Home Assistant.
        </Notice>
      );
    case 'pending':
      return (
        <Notice
          icon="clock"
          tone="info"
          title="One more step in Home Assistant"
          action={link(
            '/config/integrations/dashboard',
            'Open Devices & services'
          )}
        >
          {name} was discovered. Click <strong>Add</strong> on it under{' '}
          <em>Discovered</em> and choose a name.
        </Notice>
      );
    case 'not_set_up':
      return (
        <Notice
          icon="plus"
          tone="info"
          title="Add the Browser HASS integration"
          action={link(
            '/config/integrations/dashboard/add?domain=browser_hass',
            'Add integration'
          )}
        >
          Install <em>Browser HASS</em> through HACS and restart Home Assistant,
          then add the integration. This browser will be offered right away.
        </Notice>
      );
    case 'ignored':
    case 'disabled':
      return (
        <Notice
          icon="alert"
          tone="warning"
          title={`This browser is ${registration.status} in Home Assistant`}
          action={link(
            '/config/integrations/integration/browser_hass',
            'Open Browser HASS'
          )}
        >
          {registration.status === 'ignored'
            ? 'Find it under ignored entries and choose "Stop ignoring" to add it.'
            : 'Enable its entry to use it again.'}
        </Notice>
      );
    default:
      return (
        <Notice icon="clock" tone="info" title="Checking registration…">
          Asking Home Assistant whether this browser is set up.
        </Notice>
      );
  }
}

function Notice({
  icon,
  tone,
  title,
  children,
  action,
}: {
  icon: IconName;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`card notice tone-${tone}`}>
      <span className="notice-icon">
        <Icon name={icon} size={22} />
      </span>
      <div className="grow stack-sm">
        <div className="notice-title">{title}</div>
        <div className="muted">{children}</div>
        {action && <div className="actions start">{action}</div>}
      </div>
    </section>
  );
}
