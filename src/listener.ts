import { Connection } from './types.ts';

export function ClientConnectionListener(
  callback: (connection: Connection) => void
) {
  chrome.storage.local.get(
    ['connection'],
    ({ connection }: { connection: Connection }) => {
      if (connection) callback(connection);
    }
  );

  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area === 'local' && changes.connection) {
      callback(changes.connection.newValue as Connection);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
