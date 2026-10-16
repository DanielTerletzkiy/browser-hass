import { Connection, Options, Registration } from '../types.ts';
import {
  DefaultBrowserName,
  GetDeviceId,
  GetStatusColor,
  NormalizeUrl,
  WebsocketUrl,
} from '../utils.ts';

const REGISTER_RETRY_MS = 30_000;
const KEEPALIVE_MS = 20_000;

let socket: WebSocket | null = null;
let reconnectTimeout: any = null;
let registerTimeout: any = null;
let keepAliveInterval: any = null;
let messageId = 1;
let isAuthenticated = false;
let deviceId: string | null = null;
// id of our `browser_hass/subscribe` message, registration updates and commands arrive with it
let subscribeId: number | null = null;
let discoverId: number | null = null;
let registration: Registration = { status: 'unknown' };

// Tab whose media Home Assistant currently shows
let currentTabId: number | null = null;

let sources: Map<number, { title: string; playing: boolean }> = new Map<
  number,
  { title: string; playing: boolean }
>();

function updateStatus(status: Connection['status'], message?: string) {
  Promise.all([
    chrome.action.setBadgeBackgroundColor({
      color: GetStatusColor(status),
    }),
    chrome.action.setBadgeText({
      text: status === 'authenticated' ? '' : status.split('')[0].toUpperCase(),
    }),
  ]).finally();

  console.log('Status update:', status, message);
  chrome.storage.local.set({
    connection: {
      status,
      message,
      timestamp: Date.now(),
    },
  });
}

function updateRegistration(next: Registration) {
  registration = next;
  chrome.storage.local.set({ registration });
  // Waiting on the user in Home Assistant, hint at it on the icon
  if (isAuthenticated) {
    const attention = next.status !== 'registered';
    chrome.action
      .setBadgeBackgroundColor({ color: GetStatusColor('connecting') })
      .finally();
    chrome.action.setBadgeText({ text: attention ? '!' : '' }).finally();
  }
}

function sendWsMessage(type: string, data: any): number | null {
  if (!(socket && socket.readyState === WebSocket.OPEN)) {
    return null;
  }

  const id = messageId++;
  const msg = JSON.stringify({ id, type, ...data });
  console.log('Sending message:', msg);
  socket.send(msg);
  return id;
}

function sendState(state: any) {
  if (!deviceId) return;
  sendWsMessage('browser_hass/state', { device_id: deviceId, state });
}

function sendSources() {
  sendState({
    source_dict: Object.fromEntries(
      Array.from(sources).map(([id, val]) => [id, val.title])
    ),
  });
}

function resync() {
  currentTabId = null;
  sendSources();
  chrome.tabs.query({}, (tabs) =>
    tabs.forEach(
      (tab) =>
        tab.id &&
        chrome.tabs.sendMessage(tab.id, { type: 'resync' }).catch(() => {})
    )
  );
}

/** A tab stopped playing for good: closed, navigated away, media removed */
function removeSource(tabId: number) {
  if (!sources.delete(tabId) && tabId !== currentTabId) return;
  sendSources();
  if (tabId === currentTabId) {
    currentTabId = null;
    sendState({
      tab_id: null,
      tab_title: null,
      state: 'idle',
      volume: null,
      media_title: null,
      media_artist: null,
      media_album_name: null,
      media_image_url: null,
      media_position: null,
      media_duration: null,
    });
  }
}

function register() {
  if (registerTimeout) {
    clearTimeout(registerTimeout);
    registerTimeout = null;
  }
  subscribeId = sendWsMessage('browser_hass/subscribe', {
    device_id: deviceId,
    name: DefaultBrowserName(),
    version: chrome.runtime.getManifest().version,
  });
}

function stopTimers() {
  [reconnectTimeout, registerTimeout].forEach((t) => t && clearTimeout(t));
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  reconnectTimeout = registerTimeout = keepAliveInterval = null;
}

function handleSubscriptionEvent(event: any) {
  if (event.type === 'registration') {
    const { type, ...next } = event;
    updateRegistration(next);
    // Home Assistant resets the player whenever we (re)connect
    if (next.status === 'registered') resync();
  } else if (event.type === 'command') {
    const { command } = event;
    console.log(`Received command for tab ${command.tab_id}:`, command);
    chrome.tabs
      .sendMessage(Number(command.tab_id), { type: 'command', data: command })
      .catch(() => {});
  }
}

async function connect() {
  messageId = 1;
  subscribeId = discoverId = null;
  isAuthenticated = false;
  stopTimers();

  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onopen = null;
    socket.close();
    socket = null;
  }

  const { options }: { options?: Options } = await chrome.storage.local.get([
    'options',
  ]);
  deviceId = await GetDeviceId();
  const baseUrl = options?.url ? NormalizeUrl(options.url) : null;
  if (!baseUrl || !options?.accessToken) {
    console.log('Missing options for websocket connection');
    updateStatus('disconnected', 'Not configured yet');
    return;
  }

  const wsUrl = WebsocketUrl(baseUrl);
  console.log('Connecting to', wsUrl);
  updateStatus('connecting');

  let currentSocket: WebSocket;
  try {
    currentSocket = new WebSocket(wsUrl);
  } catch (e) {
    updateStatus('error', `Invalid URL: ${wsUrl}`);
    return;
  }
  socket = currentSocket;

  currentSocket.onopen = () => {
    console.log('WebSocket connected');
    updateStatus('connected');
    currentSocket.send(
      JSON.stringify({
        type: 'auth',
        access_token: options.accessToken,
      })
    );
  };

  currentSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message:', data);

    if (data.type === 'auth_ok') {
      isAuthenticated = true;
      updateStatus('authenticated');
      // Lets us notice right away when the integration gets added; only works
      // for admin tokens, everybody else falls back to the periodic retry
      discoverId = sendWsMessage('subscribe_events', {
        event_type: 'browser_hass_discover',
      });
      register();
      // Activity keeps the extension's service worker from being suspended
      keepAliveInterval = setInterval(
        () => sendWsMessage('ping', {}),
        KEEPALIVE_MS
      );
    } else if (data.type === 'auth_invalid') {
      console.error('Auth invalid:', data.message);
      updateStatus('error', 'Invalid access token');
      // No point in retrying until the user changes the token
      currentSocket.onclose = null;
      socket = null;
      currentSocket.close();
    } else if (data.type === 'result' && data.id === subscribeId) {
      if (data.success) return;
      if (data.error?.code === 'unknown_command') {
        updateRegistration({ status: 'not_set_up' });
      } else {
        console.error('Registration failed:', data.error);
      }
      registerTimeout = setTimeout(register, REGISTER_RETRY_MS);
    } else if (data.type === 'event' && data.id === subscribeId) {
      handleSubscriptionEvent(data.event);
    } else if (data.type === 'event' && data.id === discoverId) {
      if (registration.status === 'not_set_up') register();
    }
  };

  currentSocket.onclose = () => {
    if (socket === currentSocket) {
      socket = null;
      isAuthenticated = false;
      stopTimers();
      console.log('WebSocket closed, retrying in 5s');
      updateStatus('disconnected', 'Connection lost, retrying…');
      reconnectTimeout = setTimeout(connect, 5000);
    }
  };

  currentSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateStatus('error', `Can't reach ${baseUrl}`);
    currentSocket.close();
  };
}

updateStatus('disconnected');
connect();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.options) {
    console.log('Options changed, reconnecting...');
    updateRegistration({ status: 'unknown' });
    connect();
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'reconnect') {
    connect();
    return;
  }

  if (!isAuthenticated) return;

  if (message.type === 'media_gone') {
    if (sender.tab?.id) removeSource(sender.tab.id);
  } else if (message.type === 'media_update') {
    const isPlaying = message.data.state === 'playing';
    const current = sender.tab?.id ? sources.get(sender.tab.id) : undefined;
    if (
      sender.tab?.id &&
      (!current ||
        current.title !== sender.tab.title ||
        current.playing !== isPlaying)
    ) {
      sources.set(sender.tab.id, {
        title: sender.tab.title!,
        playing: isPlaying,
      });
      sendSources();
    }

    if (
      message.force ||
      sender.tab?.active ||
      Array.from(sources.values()).filter(({ playing }) => playing).length <= 1
    ) {
      currentTabId = sender.tab?.id ?? null;
      sendState({
        tab_id: sender.tab?.id,
        tab_title: sender.tab?.title,
        ...message.data,
      });
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (isAuthenticated) removeSource(tabId);
  else sources.delete(tabId);
});
