import { DatasetRecord } from "@/types";

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

export interface ExplainChartRequest {
    title: string;
    chart_type: string;
    data: DatasetRecord[];
    insight?: string;
}

interface ApiErrorPayload {
    detail?: string;
}

export async function explainChart(req: ExplainChartRequest): Promise<{ explanation: string }> {
    const res = await fetch(buildApiUrl("/api/explain-chart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({} as ApiErrorPayload));
        throw new Error(err.detail || "Failed to generate chart explanation");
    }
    return res.json();
}
