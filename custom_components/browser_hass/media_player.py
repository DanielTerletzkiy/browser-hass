import logging
from homeassistant.components.media_player import MediaPlayerEntity
from homeassistant.components.media_player.const import MediaPlayerEntityFeature, MediaPlayerState
from homeassistant.const import CONF_NAME, STATE_IDLE
from homeassistant.core import callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.util import slugify, dt as dt_util

from .const import DOMAIN

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


async def async_setup_entry(hass, entry, async_add_entities):
    hass.data.setdefault(DOMAIN, {})
    players = hass.data[DOMAIN].setdefault("players", {})
    browser_name = entry.data.get(CONF_NAME, entry.title)
    browser_slug = slugify(browser_name)
    entity = BrowserPlayer(hass, entry.entry_id, browser_name, browser_slug)
    players[entry.entry_id] = entity
    async_add_entities([entity])

    @callback
    def handle_state(event):
        msg = event.data
        msg_name = msg.get("name") or msg.get("device_name")
        msg_device_id = msg.get("device_id")
        
        _LOGGER.debug("Received browser_hass_state event for %s. msg_name: %s, msg_device_id: %s, target: %s", 
                     browser_name, msg_name, msg_device_id, browser_slug)
        
        if msg_name and slugify(msg_name) == browser_slug:
            _LOGGER.debug("Matched by name: %s", browser_name)
            entity.handle_state(msg)
            return
        if msg_device_id and slugify(str(msg_device_id)) == browser_slug:
            _LOGGER.debug("Matched by device_id: %s", msg_device_id)
            entity.handle_state(msg)

    remove_listener = hass.bus.async_listen("browser_hass_state", handle_state)
    entry.async_on_unload(remove_listener)
    entry.async_on_unload(lambda: players.pop(entry.entry_id, None))


class BrowserPlayer(MediaPlayerEntity):
    _attr_supported_features = SUPPORT_FEATURES

    def __init__(self, hass, entry_id, browser_name, browser_slug):
        self.hass = hass
        self.entry_id = entry_id
        self._browser_name = browser_name
        self._browser_slug = browser_slug
        self._attr_unique_id = f"{entry_id}_media_player"
        self._attr_name = browser_name
        self._attr_state = MediaPlayerState.IDLE
        self._tab_id = None
        self._tab_title = None
        self._source_dict: dict[int, str] = {}
        self._media_title = None
        self._media_artist = None
        self._media_album_name = None
        self._attr_media_image_url = None
        self._media_position = None
        self._media_position_updated_at = None
        self._media_duration = None

    @property
    def device_info(self):
        return DeviceInfo(
            identifiers={(DOMAIN, self.entry_id)},
            name=self._browser_name,
            manufacturer="Browser HASS",
            model="Browser",
        )

    @property
    def source(self):
        return self._tab_title

    @property
    def source_list(self):
        return list(self._source_dict.values())

    @property
    def volume_level(self):
        return self._volume

    @property
    def media_title(self):
        return self._media_title

    @property
    def media_artist(self):
        return self._media_artist

    @property
    def media_album_name(self):
        return self._media_album_name

    @property
    def media_position(self):
        return self._media_position

    @property
    def media_position_updated_at(self):
        return self._media_position_updated_at

    @property
    def media_duration(self):
        return self._media_duration

    def handle_state(self, msg):
        _LOGGER.debug("BrowserPlayer %s updating state with: %s", self._browser_name, msg)
        if "name" in msg and msg["name"] and msg["name"] != self._browser_name:
            self._browser_name = msg["name"]
            self._attr_name = msg["name"]
        if "tab_id" in msg:
            self._tab_id = msg["tab_id"]
        if "tab_title" in msg:
            self._tab_title = msg["tab_title"]
        if "source_dict" in msg:
            self._source_dict = {int(k): v for k, v in msg["source_dict"].items()}
        if "state" in msg:
            self._attr_state = msg["state"]
        if "volume" in msg:
            self._volume = msg["volume"]
        if "media_title" in msg:
            self._media_title = msg["media_title"]
        if "media_artist" in msg:
            self._media_artist = msg["media_artist"]
        if "media_album_name" in msg:
            self._media_album_name = msg["media_album_name"]
        if "media_image_url" in msg:
            self._attr_media_image_url = msg["media_image_url"]
        if "media_position" in msg:
            self._media_position = msg["media_position"]
            self._media_position_updated_at = dt_util.utcnow()
        if "media_duration" in msg:
            self._media_duration = msg["media_duration"]

        self.async_write_ha_state()

    async def async_select_source(self, source: str):
        pair = next((k, v) for k, v in self._source_dict.items() if v == source)
        self._tab_id = pair[0]
        self._tab_title = pair[1]

        self._send_ws({"type": "source_select"})


    async def async_media_play(self):
        self._send_ws({"type": "play"})

    async def async_media_pause(self):
        self._send_ws({"type": "pause"})

    async def async_media_next_track(self):
        self._send_ws({"type": "next"})

    async def async_media_previous_track(self):
        self._send_ws({"type": "previous"})

    async def async_media_seek(self, position):
        self._send_ws({"type": "seek", "position": position})

    async def async_set_volume_level(self, volume):
        self._send_ws({"type": "volume", "level": volume})

    async def async_play_media(self, media_type, media_id, **kwargs):
        self._send_ws({
            "type": "play_media",
            "media_type": media_type,
            "media_id": media_id
        })

    def _send_ws(self, payload):
        self.hass.bus.async_fire("browser_hass_"+self._browser_slug+"_command", {
            "name": self._browser_name,
            "tab_id": self._tab_id,
            "tab_title": self._tab_title,
            **payload
        })