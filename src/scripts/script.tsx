import {createRoot} from 'react-dom/client';
import {useEffect, useState} from "react";

import {version} from "../../public/manifest.json"
import {Connection, Options} from "../types.ts";
import {ClientConnectionListener} from "../listener.ts";
import {GetStatusColor} from "../utils.ts";

const div = document.getElementById("app") || document.createElement("div");
if (!div.id) {
    div.id = "app";
    document.body.appendChild(div);
}

let extensionOptions: Options | null = null
chrome.storage.sync.get(["options"], ({options}: { options: Options }) => {
    extensionOptions = options;
    const root = createRoot(div);
    root.render(<Entrypoint/>);
})

function Entrypoint() {
    const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
    const [status, setStatus] = useState<Connection | null>(null);

    useEffect(() => {
        ClientConnectionListener(setStatus)
    }, []);

    return <main>
        <span id={"app-header"}>
            <h1>Browser Hass</h1> <i>v{version}</i>
        </span>
        <div id={"connection-status"} style={{
            color: GetStatusColor(status?.status ?? "unknown")
        }}>
            <strong>Status:</strong> {status?.status ?? "unknown"}
            {status?.message && <div>{status.message}</div>}
        </div>

        {
            settingsVisible && <ConfigForm/>
        }

        <button onClick={() => setSettingsVisible(!settingsVisible)}>
            {settingsVisible ? 'Hide' : 'Show'} Settings
        </button>
    </main>
}

function ConfigForm() {
    const [form, setForm] = useState<Options>({
            url: extensionOptions?.url ?? "",
            accessToken: extensionOptions?.accessToken ?? "",
            deviceId: extensionOptions?.deviceId ?? ""
        }
    );

    useEffect(() => {
        // Only save if we actually have values to avoid overwriting with empty defaults on initial load if sync.get was slow
        // Actually extensionOptions is already loaded here.
        chrome.storage.sync.set({options: form})
    }, [form])

    return <div>
        <form>
            <label htmlFor={"url"}>Instance URL</label>
            <input
                id={"url"}
                value={form.url}
                onChange={e => {
                    setForm({...form, url: e.target.value})
                }}
                required
            />

            <label htmlFor={"accessToken"}>Long Lived Access Token</label>
            <input
                id={"accessToken"}
                type={"password"}
                value={form.accessToken}
                onChange={e => {
                    setForm({...form, accessToken: e.target.value})
                }}
                required
            />

            <label htmlFor={"deviceId"}>Device ID</label>
            <input
                id={"deviceId"}
                value={form.deviceId}
                onChange={e => {
                    setForm({...form, deviceId: e.target.value})
                }}
                required
            />
        </form>
    </div>
}
