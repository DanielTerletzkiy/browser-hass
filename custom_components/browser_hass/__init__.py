import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_NAME, Platform
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv, device_registry as dr
from homeassistant.util import slugify

from .const import CONF_DEVICE_ID, DOMAIN, EVENT_DISCOVER, EVENT_LEGACY_STATE
from .hub import BrowserHassHub

PLATFORMS: list[Platform] = [Platform.MEDIA_PLAYER]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

DEVICE_ID_SCHEMA = vol.All(cv.string, vol.Match(r"^[a-z0-9_]{1,64}$"))


async def async_setup(hass: HomeAssistant, config) -> bool:
    if DOMAIN in hass.data:
        return True

    hub = hass.data[DOMAIN] = BrowserHassHub(hass)

    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_state)

    @callback
    def handle_legacy_state(event: Event) -> None:
        if device_id := event.data.get(CONF_DEVICE_ID):
            hub.async_handle_state(slugify(str(device_id)), dict(event.data), legacy=True)

    hass.bus.async_listen(EVENT_LEGACY_STATE, handle_legacy_state)
    hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, hub.async_handle_device_update)

    # Browsers that connected before we were loaded retry when they see this
    hass.bus.async_fire(EVENT_DISCOVER)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Browser HASS from a config entry."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Browser HASS config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Let a still connected browser know it is no longer set up."""
    if (hub := hass.data.get(DOMAIN)) and entry.unique_id:
        # The entry is only dropped from the registry after this returns
        hass.loop.call_soon(hub.async_push_registration, entry.unique_id)


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if entry.version == 1:
        # v1 entries were matched against the slug of their name, which the
        # user had to type into the extension as the "Device ID"
        name = entry.data.get(CONF_NAME, entry.title)
        hass.config_entries.async_update_entry(
            entry,
            data={CONF_DEVICE_ID: slugify(name), CONF_NAME: name},
            unique_id=slugify(name),
            version=2,
        )
    return True


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/subscribe",
        vol.Required(CONF_DEVICE_ID): DEVICE_ID_SCHEMA,
        vol.Required(CONF_NAME): cv.string,
        vol.Optional("version"): cv.string,
    }
)
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    """Long-lived subscription of a browser: receives registration updates and commands."""
    hub: BrowserHassHub = hass.data[DOMAIN]
    connection.subscriptions[msg["id"]] = hub.async_connect(
        msg[CONF_DEVICE_ID], connection, msg["id"], msg[CONF_NAME]
    )
    connection.send_result(msg["id"])
    hub.async_push_registration(msg[CONF_DEVICE_ID])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/state",
        vol.Required(CONF_DEVICE_ID): DEVICE_ID_SCHEMA,
        vol.Required("state"): dict,
    }
)
@callback
def ws_state(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    hub: BrowserHassHub = hass.data[DOMAIN]
    hub.async_handle_state(msg[CONF_DEVICE_ID], msg["state"])
    connection.send_result(msg["id"])
