import { useEffect, useState } from 'react';

/**
 * Live value of a `chrome.storage.local` key.
 * `undefined` while loading, `null` when the key isn't set.
 */
export function useStorage<T>(key: string): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    chrome.storage.local.get([key], (items) =>
      setValue((items[key] as T | undefined) ?? null)
    );

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && key in changes) {
        setValue((changes[key].newValue as T) ?? null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  return value;
}

export function openTab(url: string) {
  chrome.tabs.create({ url }).finally(() => window.close());
}
