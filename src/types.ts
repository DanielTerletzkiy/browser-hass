export type Options = {
    url: string;
    accessToken: string;
    deviceId: string;
}

export type Connection = {
    status: "disconnected" | "connecting" | "connected" | "authenticated" | "error" | "unknown";
    message?: string;
    timestamp: number;
}