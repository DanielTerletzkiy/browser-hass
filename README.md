# Browser HASS

## What is this Integration?

This integration comes along with a browser extension, which allows you to have multiple browsers as fully functional
media player entities

## How do I use this?

### 1. Install this integration via HACS

If you don't to have HACS installed, then please look
into [the official guide](https://www.hacs.xyz/docs/use/download/download/)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=DanielTerletzkiy&repository=browser-hass&category=integration)

### 2. Set-up the Integration

Once it is installed via HACS, you can now go ahead and add it to your setup

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=browser_hass)

You can then open the integration

[![Open your Home Assistant instance and show an integration.](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=browser_hass)

And click on "Add entry" on the upper right corner to create a new "Browser".

You can name it "MY-PC Firefox" for example, and submit

There should now be a device with our chosen name with a media_player entity inside it

### 3. Install the Browser Extension for Chromium / Firefox

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Add%20to%20Chrome-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/browser-hass/lnbhnhomnjldeehjjeddphmkadnbkdkj)
[![Firefox](https://img.shields.io/badge/Firefox-Add%20to%20Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/browser-hass/)

### 4. Create Long-Lived Access Token

Go to the User Security Section in your Home Assistant user profile and scroll down to Long-lived access tokens

[![Open your Home Assistant instance and show your Home Assistant user's security options.](https://my.home-assistant.io/badges/profile_security.svg)](https://my.home-assistant.io/redirect/profile_security/)

There you have to create one, give it a sensible name so you know what it is used for

### 5. Set-up the browser extension

In the browser, left-click on the extension to bring up the configuration.
You have to fill out the fields

| Form Field   | Description                                      |
|--------------|--------------------------------------------------|
| Instance URL | _wss://your-url.example_                         |
| Token        | _your long lived token_                          |
| Device ID    | the device id. "MY-PC Firefox" > _my_pc_firefox_ |