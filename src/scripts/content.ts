let lastSent: any = null;

function getMediaInfo() {
  const mediaElements = Array.from(
    document.querySelectorAll('video, audio')
  ) as (HTMLVideoElement | HTMLAudioElement)[];
  const playing = mediaElements.find((m) => !m.paused && !m.ended);
  const media = playing || (mediaElements.length > 0 ? mediaElements[0] : null);

  if (!media) return null;

  const { metadata } = navigator.mediaSession;

  let artworkUrl = '';
  if (metadata?.artwork && metadata.artwork.length > 0) {
    // Pick largest or last
    artworkUrl = metadata.artwork[metadata.artwork.length - 1].src;
  } else if (media instanceof HTMLVideoElement && media.poster) {
    artworkUrl = media.poster;
  }

  if (
    artworkUrl &&
    !artworkUrl.startsWith('http') &&
    !artworkUrl.startsWith('data:')
  ) {
    try {
      artworkUrl = new URL(artworkUrl, document.baseURI).href;
    } catch (e) {
      console.error('Failed to resolve artwork URL', e);
    }
  }

  return {
    state: media.paused || media.ended ? 'paused' : 'playing',
    volume: media.volume,
    media_title: metadata?.title || document.title || 'Unknown Track',
    media_artist: metadata?.artist || '',
    media_album_name: metadata?.album || '',
    media_image_url: artworkUrl,
    media_position: media.currentTime,
    media_duration: media.duration,
  };
}

function sendUpdate(force = false) {
  const info = getMediaInfo();
  if (!info) return;

  // Deep compare to avoid redundant messages

  if (!force) {
    if (
      lastSent &&
      lastSent.state === info.state &&
      Math.abs(lastSent.volume - info.volume) < 0.01 &&
      lastSent.media_title === info.media_title &&
      lastSent.media_artist === info.media_artist &&
      lastSent.media_album_name === info.media_album_name &&
      lastSent.media_image_url === info.media_image_url &&
      Math.abs(lastSent.media_position - info.media_position) < 1
    ) {
      return;
    }
  }

  lastSent = info;
  chrome.runtime.sendMessage({ type: 'media_update', data: info, force });
}

function setupListeners(media: HTMLMediaElement) {
  media.addEventListener('play', () => sendUpdate());
  media.addEventListener('pause', () => sendUpdate());
  media.addEventListener('volumechange', () => sendUpdate());
  media.addEventListener('ended', () => sendUpdate());
  media.addEventListener('seeked', () => sendUpdate());
}

function triggerMediaCommand(command: 'next' | 'previous') {
  const selectors =
    command === 'next'
      ? [
          '.ytp-next-button',
          "[data-testid='control-button-skip-forward']",
          "[aria-label*='Next']",
          "[aria-label*='Skip forward']",
          "[title*='Next']",
          '.skip-next',
          '.next-button',
        ]
      : [
          '.ytp-prev-button',
          "[data-testid='control-button-skip-back']",
          "[aria-label*='Previous']",
          "[aria-label*='Skip backward']",
          "[title*='Previous']",
          '.skip-prev',
          '.prev-button',
        ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && typeof (element as any).click === 'function') {
      (element as any).click();
      return;
    }
  }

  // Fallback to text search in buttons
  const buttons = Array.from(
    document.querySelectorAll("button, [role='button']")
  ) as HTMLElement[];
  const searchTerms =
    command === 'next'
      ? ['next', 'skip forward']
      : ['previous', 'skip backward', 'prev'];

  for (const button of buttons) {
    const text = (
      button.textContent ||
      button.getAttribute('aria-label') ||
      button.getAttribute('title') ||
      ''
    ).toLowerCase();
    if (searchTerms.some((term) => text.includes(term))) {
      if (typeof (button as any).click === 'function') {
        (button as any).click();
        return;
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'command') {
    return;
  }

  const mediaElements = Array.from(
    document.querySelectorAll('video, audio')
  ) as (HTMLVideoElement | HTMLAudioElement)[];
  const playing = mediaElements.find((m) => !m.paused && !m.ended);
  const media = playing || (mediaElements.length > 0 ? mediaElements[0] : null);
  if (!media) return;
  const command = message.data.type;
  console.log('Executing command:', command, message.data);
  switch (command) {
    case 'source_select':
      sendUpdate(true);
      break;
    case 'play':
      media.play();
      break;
    case 'pause':
      media.pause();
      break;
    case 'seek':
      if (typeof message.data.position === 'number') {
        media.currentTime = message.data.position;
      }
      break;
    case 'volume':
      if (typeof message.data.level === 'number') {
        media.volume = message.data.level;
      }
      break;
    case 'next':
      triggerMediaCommand('next');
      break;
    case 'previous':
      triggerMediaCommand('previous');
      break;
  }
});

// Initial setup
document
  .querySelectorAll('video, audio')
  .forEach((m) => setupListeners(m as HTMLMediaElement));
sendUpdate();

// Mutation Observer to catch new media elements
const observer = new MutationObserver((mutations) => {
  let added = false;
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof HTMLMediaElement) {
        setupListeners(node);
        added = true;
      } else if (node instanceof HTMLElement) {
        const mediaElements = node.querySelectorAll('video, audio');
        if (mediaElements.length > 0) {
          mediaElements.forEach((m) => setupListeners(m as HTMLMediaElement));
          added = true;
        }
      }
    });
  });
  if (added) sendUpdate();
});

observer.observe(document.body, { childList: true, subtree: true });

// Monitor title and mediaSession changes (polling as a fallback because there's no event for mediaSession metadata changes)
setInterval(sendUpdate, 2000);
