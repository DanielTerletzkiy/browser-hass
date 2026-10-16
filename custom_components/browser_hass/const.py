DOMAIN = "browser_hass"

CONF_DEVICE_ID = "device_id"

# Fired when the integration starts so connected extensions re-register right away
EVENT_DISCOVER = f"{DOMAIN}_discover"

# Legacy event bus protocol used by extension versions <= 0.1.x
EVENT_LEGACY_STATE = f"{DOMAIN}_state"
