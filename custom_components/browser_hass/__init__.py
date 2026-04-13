from homeassistant.const import Platform

from .const import DOMAIN

PLATFORMS: list[Platform] = [Platform.MEDIA_PLAYER]


async def async_setup(hass, config):
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass, entry):
    """Set up Browser HASS from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass, entry):
    """Unload a Browser HASS config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
