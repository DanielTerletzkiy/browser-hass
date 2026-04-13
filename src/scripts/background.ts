import {Connection, Options} from "../types.ts";
import {GetStatusColor} from "../utils.ts";

let socket: WebSocket | null = null;
let reconnectTimeout: any = null;
let messageId = 1;
let isAuthenticated = false;

let sources: Map<number, { title: string, playing: boolean }> = new Map<number, { title: string, playing: boolean }>()

function updateStatus(status: Connection['status'], message?: string) {

    Promise.all([
        chrome.action.setBadgeBackgroundColor(
            {
                color: GetStatusColor(status)
            },
        ),
        chrome.action.setBadgeText(
            {
                text: status.split("")[0].toUpperCase(),
            }
        )
    ]).finally()

    console.log("Status update:", status, message);
    chrome.storage.local.set({
        connection: {
            status,
            message,
            timestamp: Date.now()
        }
    });
}

function sendWsMessage(type: string, data: any) {
    if (!(socket && socket.readyState === WebSocket.OPEN)) {
        return;
    }

    const msg = JSON.stringify({
        id: messageId++,
        type,
        ...data
    });
    console.log("Sending message:", msg);
    socket.send(msg);
}

function sendWsMessageWithDeviceId(type: string, event_type: string, data: any) {
    chrome.storage.sync.get(["options"], ({options}: { options: Options }) => {
        if (!options || !options.deviceId) return;

        sendWsMessage(type, {
            event_type,
            event_data: {
                device_id: options.deviceId,
                ...data
            }
        });
    });
}

function connect() {
    messageId = 1;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;
        socket.close();
        socket = null;
    }

    chrome.storage.sync.get(["options"], ({options}: { options: Options }) => {
        if (!options || !options.url || !options.accessToken) {
            console.log("Missing options for websocket connection");
            updateStatus("disconnected", "Missing configuration");
            return;
        }

        const wsUrl = options.url.replace(/^http/, 'ws') + "/api/websocket";
        console.log("Connecting to", wsUrl);
        updateStatus("connecting");

        const currentSocket = new WebSocket(wsUrl);
        socket = currentSocket;

        currentSocket.onopen = () => {
            console.log("WebSocket connected");
            updateStatus("connected");
            // Auth
            currentSocket.send(JSON.stringify({
                type: "auth",
                access_token: options.accessToken
            }));
        };

        currentSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WebSocket message:", data);

            if (data.type === "auth_ok") {
                console.log("Authenticated");
                isAuthenticated = true;
                updateStatus("authenticated");
                // Subscribe to command events
                sendWsMessage("subscribe_events", {
                    event_type: `browser_hass_${options.deviceId}_command`
                });
            } else if (data.type === "event" && data.event?.event_type === `browser_hass_${options.deviceId}_command`) {
                console.log(`Received browser_hass_command for ${options.deviceId} -> ${data.event.data.tab_id}:`, data.event.data);

                chrome.tabs.sendMessage(Number(data.event.data.tab_id), {
                    type: "command",
                    data: data.event.data
                }).catch()

                // Forward command to all tabs
                // chrome.tabs.query({}, (tabs) => {
                //     tabs.forEach(tab => {
                //         if (tab.id) {
                //             chrome.tabs.sendMessage(tab.id, {
                //                 type: "command",
                //                 data: data.event.data
                //             }).catch(err => {
                //                 // Ignore errors for tabs where content script isn't loaded
                //             });
                //         }
                //     });
                // });
            } else if (data.type === "auth_invalid") {
                console.error("Auth invalid:", data.message);
                updateStatus("error", "Invalid access token: " + data.message);
                // Don't retry automatically on auth invalid? Or retry anyway?
                // Probably better to let user fix it.
                currentSocket.close();
            }
        };

        currentSocket.onclose = () => {
            if (socket === currentSocket) {
                socket = null;
                isAuthenticated = false;
                console.log("WebSocket closed, retrying in 5s");
                updateStatus("disconnected", "Connection closed, retrying in 5s");
                reconnectTimeout = setTimeout(connect, 5000);
            }
        };

        currentSocket.onerror = (error) => {
            console.error("WebSocket error:", error);
            updateStatus("error", "WebSocket error");
            currentSocket.close();
        };
    });
}

updateStatus("disconnected");
connect();

// Listen for storage changes to reconnect
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.options) {
        console.log("Options changed, reconnecting...");
        connect();
    }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (!isAuthenticated) return;

    if (message.type === "media_update") {
        const isPlaying = message.data.state === "playing";
        const current = sender.tab?.id ? sources.get(sender.tab.id) : undefined;
        if (
            sender.tab?.id && (
                !current
                || current.title !== sender.tab.title
                || current.playing !== isPlaying
            )
        ) {
            sources.set(sender.tab.id, {title: sender.tab.title!, playing: isPlaying})
            sendWsMessageWithDeviceId("fire_event", "browser_hass_state", {
                source_dict: Object.fromEntries(Array.from(sources).map(([id, val]) => [id, val.title]))
            })
        }

        if (message.force || sender.tab?.active || Array.from(sources.values()).filter(({playing}) => playing).length <= 1) {
            sendWsMessageWithDeviceId("fire_event", "browser_hass_state", {
                tab_id: sender.tab?.id,
                tab_title: sender.tab?.title,
                ...message.data
            })
        }
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    sources.delete(tabId)
    sendWsMessageWithDeviceId("fire_event", "browser_hass_state", {
        source_dict: Object.fromEntries(Array.from(sources).map(([id, val]) => [id, val.title]))
    })
})
