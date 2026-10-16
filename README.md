# Browser HASS

## What is this Integration?

This integration comes along with a browser extension, which allows you to have multiple browsers as fully functional
media player entities

## How do I use this?

### 1. Install this integration via HACS

If you don't to have HACS installed, then please look
into [the official guide](https://www.hacs.xyz/docs/use/download/download/)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=DanielTerletzkiy&repository=browser-hass&category=integration)

Restart Home Assistant afterwards.

### 2. Install the Browser Extension for Chromium / Firefox

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Add%20to%20Chrome-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/browser-hass/lnbhnhomnjldeehjjeddphmkadnbkdkj)
[![Firefox](https://img.shields.io/badge/Firefox-Add%20to%20Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/browser-hass/)

### 3. Connect the extension

Click on the extension icon and fill out the two fields:

| Form Field              | Description                                                         |
|-------------------------|---------------------------------------------------------------------|
| Home Assistant URL      | the address you open Home Assistant with, e.g. _http://homeassistant.local:8123_ |
| Long-lived access token | create one in your profile, see below                               |

[![Open your Home Assistant instance and show your Home Assistant user's security options.](https://my.home-assistant.io/badges/profile_security.svg)](https://my.home-assistant.io/redirect/profile_security/)

Scroll down to _Long-lived access tokens_, create one and give it a sensible name so you know what it is used for.
The token should belong to an administrator, otherwise newly added integrations are only picked up after up to 30 seconds.

### 4. Add the browser in Home Assistant

The browser registers itself, there is no ID to copy around.

- **First browser:** add the integration once. Every connected browser is offered right away, pick one and give it a name.

  [![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=browser_hass)

- **Every browser after that:** it shows up under _Discovered_ in _Settings → Devices & services_. Click **Add**, choose a name, done.

The extension popup always tells you what is left to do and links to the right page.
Afterwards there is a device with your chosen name and a `media_player` entity inside it. You can rename it any time on the device page.

### Upgrading from 0.1.x

Existing browsers keep working: the extension keeps the _Device ID_ you typed in before and the integration migrates its entries to match it.
Update both the integration and the extension.
