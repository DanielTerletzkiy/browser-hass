import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.const import CONF_NAME
from homeassistant.util import slugify

from .const import DOMAIN


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema(
                    {
                        vol.Required(CONF_NAME): str,
                    }
                ),
            )

        browser_name = user_input[CONF_NAME].strip()
        if not browser_name:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema({vol.Required(CONF_NAME): str}),
                errors={CONF_NAME: "required"},
            )

        await self.async_set_unique_id(slugify(browser_name))
        self._abort_if_unique_id_configured()

        return self.async_create_entry(
            title=browser_name,
            data={CONF_NAME: browser_name},
        )
