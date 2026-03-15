const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (configured) {
        return trimTrailingSlash(configured);
    }

    if (typeof window !== "undefined") {
        const { origin, hostname } = window.location;
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            return trimTrailingSlash(origin);
        }
    }

    return DEFAULT_LOCAL_API_BASE_URL;
}

export function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
}
