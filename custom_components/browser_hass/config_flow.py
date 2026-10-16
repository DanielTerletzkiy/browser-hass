import asyncio

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.const import CONF_NAME
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
)
from homeassistant.setup import async_setup_component

from .const import CONF_DEVICE_ID, DOMAIN

# How long to wait for already running extensions to check in after we got loaded
DISCOVERY_WAIT = 3


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 2

    def __init__(self) -> None:
        self._device_id: str | None = None
        self._name: str | None = None
        self._browsers: dict[str, str] = {}

    async def async_step_integration_discovery(self, discovery_info) -> ConfigFlowResult:
        """A browser running the extension connected but is not set up yet."""
        self._device_id = discovery_info[CONF_DEVICE_ID]
        self._name = discovery_info[CONF_NAME]
        await self.async_set_unique_id(self._device_id)
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": self._name}
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input=None) -> ConfigFlowResult:
        if user_input is not None:
            return self._create_entry(user_input[CONF_NAME])

        return self.async_show_form(
            step_id="confirm",
            data_schema=vol.Schema({vol.Required(CONF_NAME, default=self._name): str}),
            description_placeholders={"name": self._name},
        )

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        """Manual "Add integration": pick one of the connected browsers."""
        if user_input is not None:
            self._device_id = user_input[CONF_DEVICE_ID]
            self._name = self._browsers.get(self._device_id)
            # A discovery flow for the same browser may be open, this one wins
            await self.async_set_unique_id(self._device_id, raise_on_progress=False)
            self._abort_if_unique_id_configured()
            return self._create_entry(user_input.get(CONF_NAME, ""))

        if DOMAIN not in self.hass.config.components:
            # Without any entries the integration isn't loaded, so nothing was
            # listening for browsers yet. Load it and give them a moment.
            await async_setup_component(self.hass, DOMAIN, {})
            await asyncio.sleep(DISCOVERY_WAIT)

        hub = self.hass.data[DOMAIN]
        configured = self._async_current_ids(include_ignore=True)
        self._browsers = browsers = {
            device_id: session.name
            for device_id, session in hub.sessions.items()
            if device_id not in configured
        }
        if not browsers:
            return self.async_abort(reason="no_browsers")

        first_id, first_name = next(iter(browsers.items()))
        # With several browsers the suggestion could belong to the wrong one,
        # an empty name falls back to the selected browser's own name
        suggested = {"suggested_value": first_name} if len(browsers) == 1 else None
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_DEVICE_ID, default=first_id): SelectSelector(
                        SelectSelectorConfig(
                            options=[
                                SelectOptionDict(value=device_id, label=name)
                                for device_id, name in browsers.items()
                            ]
                        )
                    ),
                    vol.Optional(CONF_NAME, description=suggested): str,
                }
            ),
        )

    def _create_entry(self, name: str) -> ConfigFlowResult:
        name = name.strip() or self._name or "Browser"
        return self.async_create_entry(
            title=name,
            data={CONF_DEVICE_ID: self._device_id, CONF_NAME: name},
        )
