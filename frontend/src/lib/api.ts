const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

    if (typeof window !== "undefined") {
        // When running in the browser, hit the Next.js API proxy which rewrites to the configured backend
        // This entirely eliminates CORS issues
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
