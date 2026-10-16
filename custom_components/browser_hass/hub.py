"""Keeps track of connected browsers and routes messages between them and their entities."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import SOURCE_IGNORE, SOURCE_INTEGRATION_DISCOVERY
from homeassistant.const import CONF_NAME
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, discovery_flow

from .const import CONF_DEVICE_ID, DOMAIN

if TYPE_CHECKING:
    from .media_player import BrowserPlayer

_LOGGER = logging.getLogger(__name__)


@dataclass
class BrowserSession:
    connection: websocket_api.ActiveConnection
    msg_id: int
    name: str


class BrowserHassHub:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.sessions: dict[str, BrowserSession] = {}
        self.players: dict[str, BrowserPlayer] = {}

    def is_connected(self, device_id: str) -> bool:
        return device_id in self.sessions

    @callback
    def async_connect(
        self, device_id: str, connection: websocket_api.ActiveConnection, msg_id: int, name: str
    ):
        """Register a browser websocket session, returns a callback that ends it."""
        session = BrowserSession(connection, msg_id, name)
        self.sessions[device_id] = session
        if player := self.players.get(device_id):
            # Whatever played before the browser went away is likely stale
            player.async_reset()
        self._async_update_player(device_id)

        @callback
        def disconnect() -> None:
            if self.sessions.get(device_id) is session:
                del self.sessions[device_id]
                self._async_update_player(device_id)

        return disconnect

    @callback
    def async_add_player(self, device_id: str, player: BrowserPlayer) -> None:
        self.players[device_id] = player
        self.async_push_registration(device_id)

    @callback
    def async_remove_player(self, device_id: str, player: BrowserPlayer) -> None:
        if self.players.get(device_id) is player:
            del self.players[device_id]

    @callback
    def async_handle_state(
        self, device_id: str, state: dict[str, Any], legacy: bool = False
    ) -> None:
        if player := self.players.get(device_id):
            player.async_handle_state(state, legacy)

    @callback
    def async_send_command(self, device_id: str, command: dict[str, Any]) -> None:
        if session := self.sessions.get(device_id):
            session.connection.send_message(
                websocket_api.event_message(
                    session.msg_id, {"type": "command", "command": command}
                )
            )
        else:
            # Older extensions listen on the event bus instead of a websocket subscription
            self.hass.bus.async_fire(f"{DOMAIN}_{device_id}_command", command)

    @callback
    def async_push_registration(self, device_id: str) -> None:
        """Tell a connected browser whether it is set up, starting discovery when it isn't."""
        if (session := self.sessions.get(device_id)) is None:
            return
        registration = self._registration(device_id, session.name)
        session.connection.send_message(
            websocket_api.event_message(
                session.msg_id, {"type": "registration", **registration}
            )
        )

    @callback
    def async_handle_device_update(self, event: Event) -> None:
        if event.data["action"] != "update":
            return
        device = dr.async_get(self.hass).async_get(event.data["device_id"])
        if device is None:
            return
        for entry_id in device.config_entries:
            entry = self.hass.config_entries.async_get_entry(entry_id)
            if entry and entry.domain == DOMAIN and entry.unique_id:
                self.async_push_registration(entry.unique_id)

    @callback
    def _registration(self, device_id: str, name: str) -> dict[str, Any]:
        entry = self.hass.config_entries.async_entry_for_domain_unique_id(DOMAIN, device_id)
        if entry is None:
            self._async_start_discovery(device_id, name)
            return {"status": "pending", "name": name}
        if entry.source == SOURCE_IGNORE:
            return {"status": "ignored", "name": entry.title}
        if entry.disabled_by:
            return {"status": "disabled", "name": entry.title}

        device = dr.async_get(self.hass).async_get_device(identifiers={(DOMAIN, entry.entry_id)})
        player = self.players.get(device_id)
        return {
            "status": "registered",
            "name": (device.name_by_user or device.name) if device else entry.title,
            "device_registry_id": device.id if device else None,
            "entity_id": player.entity_id if player else None,
        }

    @callback
    def _async_start_discovery(self, device_id: str, name: str) -> None:
        for flow in self.hass.config_entries.flow.async_progress_by_handler(DOMAIN):
            if flow["context"].get("unique_id") == device_id:
                return
        _LOGGER.debug("Discovered browser %s (%s)", name, device_id)
        discovery_flow.async_create_flow(
            self.hass,
            DOMAIN,
            context={"source": SOURCE_INTEGRATION_DISCOVERY},
            data={CONF_DEVICE_ID: device_id, CONF_NAME: name},
        )

    @callback
    def _async_update_player(self, device_id: str) -> None:
        if player := self.players.get(device_id):
            player.async_write_ha_state()
