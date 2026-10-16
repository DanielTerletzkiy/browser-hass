import logging
from typing import Any

from homeassistant.components.media_player import MediaPlayerEntity
from homeassistant.components.media_player.const import MediaPlayerEntityFeature, MediaPlayerState
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import CONF_DEVICE_ID, DOMAIN
from .hub import BrowserHassHub

_LOGGER = logging.getLogger(__name__)

SUPPORT_FEATURES = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.SEEK
        | MediaPlayerEntityFeature.SELECT_SOURCE
        | MediaPlayerEntityFeature.VOLUME_SET
)

# Fields of a state message that map 1:1 onto entity attributes
STATE_ATTRIBUTES = {
    "state": "_attr_state",
    "volume": "_attr_volume_level",
    "media_title": "_attr_media_title",
    "media_artist": "_attr_media_artist",
    "media_album_name": "_attr_media_album_name",
    "media_image_url": "_attr_media_image_url",
    "media_duration": "_attr_media_duration",
}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
):
    async_add_entities([BrowserPlayer(hass.data[DOMAIN], entry)])


class BrowserPlayer(MediaPlayerEntity):
    _attr_supported_features = SUPPORT_FEATURES
    _attr_has_entity_name = True
    _attr_name = None
    _attr_state = MediaPlayerState.IDLE

    def __init__(self, hub: BrowserHassHub, entry: ConfigEntry):
        self._hub = hub
        self._device_id: str = entry.data[CONF_DEVICE_ID]
        self._attr_unique_id = f"{entry.entry_id}_media_player"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Browser HASS",
            model="Browser",
        )
        self._tab_id: int | None = None
        self._source_dict: dict[int, str] = {}
        self._legacy = False

    @property
    def available(self) -> bool:
        # Browsers on the old event bus protocol have no session we could watch
        return self._legacy or self._hub.is_connected(self._device_id)

    async def async_added_to_hass(self) -> None:
        # Only route messages to the entity once it is actually added, writing
        # state before that (or after removal) fails because `hass` is unset
        self._hub.async_add_player(self._device_id, self)

    async def async_will_remove_from_hass(self) -> None:
        self._hub.async_remove_player(self._device_id, self)

    @callback
    def async_reset(self) -> None:
        """Forget the last media, the browser resends whatever is still playing."""
        self._attr_state = MediaPlayerState.IDLE
        self._tab_id = None
        self._source_dict = {}
        self._attr_source = None
        self._attr_source_list = None
        for attr in STATE_ATTRIBUTES.values():
            if attr != "_attr_state":
                setattr(self, attr, None)
        self._attr_media_position = None
        self._attr_media_position_updated_at = None

    @callback
    def async_handle_state(self, msg: dict[str, Any], legacy: bool = False) -> None:
        _LOGGER.debug("Browser %s updating state with: %s", self._device_id, msg)
        self._legacy = legacy
        if "tab_id" in msg:
            self._tab_id = msg["tab_id"]
        if "tab_title" in msg:
            self._attr_source = msg["tab_title"]
        if "source_dict" in msg:
            self._source_dict = {int(k): v for k, v in msg["source_dict"].items()}
            self._attr_source_list = list(self._source_dict.values())
        for key, attr in STATE_ATTRIBUTES.items():
            if key in msg:
                setattr(self, attr, msg[key])
        if "media_position" in msg:
            self._attr_media_position = msg["media_position"]
            self._attr_media_position_updated_at = (
                dt_util.utcnow() if msg["media_position"] is not None else None
            )

        self.async_write_ha_state()

    async def async_select_source(self, source: str):
        tab_id = next((k for k, v in self._source_dict.items() if v == source), None)
        if tab_id is None:
            return
        self._tab_id = tab_id
        self._attr_source = source
        self._send_command({"type": "source_select"})

    async def async_media_play(self):
        self._send_command({"type": "play"})

    async def async_media_pause(self):
        self._send_command({"type": "pause"})

    async def async_media_next_track(self):
        self._send_command({"type": "next"})

    async def async_media_previous_track(self):
        self._send_command({"type": "previous"})

    async def async_media_seek(self, position):
        self._send_command({"type": "seek", "position": position})

    async def async_set_volume_level(self, volume):
        self._send_command({"type": "volume", "level": volume})

    async def async_play_media(self, media_type, media_id, **kwargs):
        self._send_command({
            "type": "play_media",
            "media_type": media_type,
            "media_id": media_id
        })

    def _send_command(self, payload):
        self._hub.async_send_command(self._device_id, {
            "tab_id": self._tab_id,
            "tab_title": self._attr_source,
            **payload
        })
