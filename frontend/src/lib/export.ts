import { DashboardWidget } from "@/types";
import { buildApiUrl } from "@/lib/api";

function sanitizeFilename(value: string, fallback = "lumina_export") {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return normalized || fallback;
}

function extractFilename(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) {
        return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }

    return fallback;
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export async function downloadWidgetCsv(widget: DashboardWidget) {
    const response = await fetch(buildApiUrl("/api/export/widget-csv"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sql: widget.sql,
            title: widget.title,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        let detail = "Failed to export CSV.";
        try {
            const payload = JSON.parse(text) as { detail?: string };
            if (payload?.detail) detail = payload.detail;
        } catch {
            if (text) detail = text;
        }
        throw new Error(detail);
    }

    const blob = await response.blob();
    const fallbackName = `${sanitizeFilename(widget.title)}.csv`;
    const filename = extractFilename(response.headers.get("Content-Disposition"), fallbackName);
    downloadBlob(blob, filename);
}

export function exportDashboardPdf(title: string) {
    const previousTitle = document.title;
    document.title = sanitizeFilename(title, "lumina_dashboard");
    window.print();
    window.setTimeout(() => {
        document.title = previousTitle;
    }, 500);
}
