const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

    if (typeof window !== "undefined") {
        if (configured) {
            return trimTrailingSlash(configured);
        }

        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            // Avoid Next.js proxy body limits for large CSV uploads during local dev.
            return DEFAULT_LOCAL_API_BASE_URL;
        }

        // Fall back to same-origin (useful behind reverse proxies).
        return "";
    }

    if (configured) {
        return trimTrailingSlash(configured);
    }

    return DEFAULT_LOCAL_API_BASE_URL;
}

export function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
}
