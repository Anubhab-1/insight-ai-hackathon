import { DashboardWidget } from "@/types";
import { buildApiUrl } from "@/lib/api";

const DASHBOARD_EXPORT_ROOT_SELECTOR = '[data-export-root="dashboard-report"]';

const DASHBOARD_EXPORT_STYLES = `
  :root {
    color-scheme: light;
  }

  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #f4efe6 !important;
    color: #1f2937 !important;
  }

  body {
    font-family: var(--font-display), "Segoe UI", system-ui, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .lumina-export-document {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(217, 119, 6, 0.14), transparent 28%),
      radial-gradient(circle at top left, rgba(8, 145, 178, 0.12), transparent 24%),
      linear-gradient(180deg, #f4efe6 0%, #f8f4ed 18%, #f7f3ee 100%);
  }

  .lumina-export-page {
    width: min(1080px, calc(100% - 48px));
    margin: 0 auto;
    padding: 28px 0 40px;
  }

  .lumina-export-banner {
    margin-bottom: 18px;
    padding: 28px 30px;
    border-radius: 28px;
    background: linear-gradient(135deg, #171222 0%, #2a1d42 52%, #2e5b67 100%);
    color: #f8fafc !important;
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
  }

  .lumina-export-kicker {
    margin: 0 0 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.78) !important;
  }

  .lumina-export-banner h1 {
    margin: 0;
    font-size: 32px;
    line-height: 1.08;
    color: #ffffff !important;
  }

  .lumina-export-meta {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 20px;
  }

  .lumina-export-meta-block {
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .lumina-export-meta-label {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.72) !important;
  }

  .lumina-export-meta-value {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: #ffffff !important;
  }

  [data-export-root="dashboard-report"] {
    display: block !important;
    padding-bottom: 0 !important;
    color: #1f2937 !important;
  }

  [data-export-root="dashboard-report"] * {
    animation: none !important;
    transition: none !important;
  }

  [data-export-root="dashboard-report"] [data-export-hide="true"] {
    display: none !important;
  }

  [data-export-root="dashboard-report"] [data-export-grid="kpis"] {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 14px !important;
  }

  [data-export-root="dashboard-report"] [data-export-grid="widgets"],
  [data-export-root="dashboard-report"] [data-export-grid="decision-panels"] {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 18px !important;
  }

  [data-export-root="dashboard-report"] [data-export-card] {
    break-inside: avoid;
    page-break-inside: avoid;
    background: #ffffff !important;
    border: 1px solid #e7dfd1 !important;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  [data-export-root="dashboard-report"] [data-export-card]::before,
  [data-export-root="dashboard-report"] [data-export-card]::after,
  [data-export-root="dashboard-report"] [data-export-decor="true"] {
    display: none !important;
  }

  [data-export-root="dashboard-report"] [data-export-card],
  [data-export-root="dashboard-report"] [data-export-card] p,
  [data-export-root="dashboard-report"] [data-export-card] span,
  [data-export-root="dashboard-report"] [data-export-card] h1,
  [data-export-root="dashboard-report"] [data-export-card] h2,
  [data-export-root="dashboard-report"] [data-export-card] h3,
  [data-export-root="dashboard-report"] [data-export-card] div,
  [data-export-root="dashboard-report"] [data-export-card] strong,
  [data-export-root="dashboard-report"] [data-export-card] button {
    color: #1f2937 !important;
    text-shadow: none !important;
  }

  [data-export-root="dashboard-report"] .nv-gradient-text {
    background: none !important;
    -webkit-text-fill-color: #111827 !important;
    color: #111827 !important;
  }

  [data-export-root="dashboard-report"] .nv-pill,
  [data-export-root="dashboard-report"] .nv-pill-cyan,
  [data-export-root="dashboard-report"] .nv-pill-emerald {
    background: #f5f0ff !important;
    border-color: #dccdf8 !important;
    color: #5b21b6 !important;
    box-shadow: none !important;
  }

  [data-export-root="dashboard-report"] .border-glow-violet,
  [data-export-root="dashboard-report"] .nv-glow {
    box-shadow: none !important;
  }

  [data-export-root="dashboard-report"] svg {
    filter: none !important;
  }

  [data-export-root="dashboard-report"] [data-export-chart="true"] {
    min-height: 320px;
  }

  [data-export-root="dashboard-report"] .overflow-auto,
  [data-export-root="dashboard-report"] .overflow-x-auto,
  [data-export-root="dashboard-report"] .overflow-hidden {
    overflow: visible !important;
  }

  [data-export-root="dashboard-report"] table {
    width: 100% !important;
    border-collapse: collapse !important;
  }

  [data-export-root="dashboard-report"] th,
  [data-export-root="dashboard-report"] td {
    border-color: #e5e7eb !important;
  }

  [data-export-root="dashboard-report"] [data-export-static="followup"] {
    pointer-events: none !important;
    cursor: default !important;
    box-shadow: none !important;
  }

  [data-export-root="dashboard-report"] .recharts-cartesian-grid line,
  [data-export-root="dashboard-report"] .recharts-cartesian-axis line {
    stroke: #d1d5db !important;
  }

  [data-export-root="dashboard-report"] .recharts-cartesian-axis-tick-value tspan,
  [data-export-root="dashboard-report"] .recharts-legend-item-text,
  [data-export-root="dashboard-report"] .recharts-text tspan {
    fill: #4b5563 !important;
  }

  [data-export-root="dashboard-report"] .recharts-surface {
    overflow: visible !important;
  }

  @media print {
    .lumina-export-page {
      width: 100%;
      padding: 0;
    }

    .lumina-export-banner {
      box-shadow: none;
    }
  }

  @media (max-width: 900px) {
    .lumina-export-page {
      width: calc(100% - 32px);
    }

    .lumina-export-meta,
    [data-export-root="dashboard-report"] [data-export-grid="kpis"] {
      grid-template-columns: 1fr !important;
    }
  }
`;

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

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function collectDocumentStyles() {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join("\n");
}

function sanitizeExportNode(node: HTMLElement) {
    node.querySelectorAll<HTMLElement>('[data-export-hide="true"]').forEach((element) => {
        element.remove();
    });

    node.querySelectorAll<HTMLElement>('[data-export-static="followup"]').forEach((element) => {
        element.setAttribute("aria-disabled", "true");
        element.tabIndex = -1;
    });
}

function buildExportDocument(
    markup: string,
    options: { title: string; query?: string; confidence?: string }
) {
    const generatedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date());

    const safeTitle = escapeHtml(options.title);
    const safeQuery = escapeHtml(options.query || "Executive report");
    const safeConfidence = escapeHtml((options.confidence || "medium").toUpperCase());

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(sanitizeFilename(options.title, "lumina_dashboard"))}</title>
    ${collectDocumentStyles()}
    <style>${DASHBOARD_EXPORT_STYLES}</style>
  </head>
  <body class="lumina-export-document">
    <main class="lumina-export-page">
      <section class="lumina-export-banner">
        <p class="lumina-export-kicker">Lumina Executive Report</p>
        <h1>${safeTitle}</h1>
        <div class="lumina-export-meta">
          <div class="lumina-export-meta-block">
            <p class="lumina-export-meta-label">Question</p>
            <p class="lumina-export-meta-value">${safeQuery}</p>
          </div>
          <div class="lumina-export-meta-block">
            <p class="lumina-export-meta-label">Generated</p>
            <p class="lumina-export-meta-value">${escapeHtml(generatedAt)}</p>
          </div>
          <div class="lumina-export-meta-block">
            <p class="lumina-export-meta-label">Confidence</p>
            <p class="lumina-export-meta-value">${safeConfidence}</p>
          </div>
        </div>
      </section>
      ${markup}
    </main>
  </body>
</html>`;
}

function fallbackPrint(title: string) {
    const previousTitle = document.title;
    document.title = sanitizeFilename(title, "lumina_dashboard");
    window.print();
    window.setTimeout(() => {
        document.title = previousTitle;
    }, 500);
}

export function exportDashboardPdf(options: { title: string; query?: string; confidence?: string }) {
    const report = document.querySelector<HTMLElement>(DASHBOARD_EXPORT_ROOT_SELECTOR);
    if (!report) {
        fallbackPrint(options.title);
        return;
    }

    const printWindow = window.open("", "_blank", "width=1280,height=960");
    if (!printWindow) {
        fallbackPrint(options.title);
        return;
    }

    const clonedReport = report.cloneNode(true) as HTMLElement;
    sanitizeExportNode(clonedReport);

    printWindow.document.open();
    printWindow.document.write(buildExportDocument(clonedReport.outerHTML, options));
    printWindow.document.close();

    printWindow.onafterprint = () => {
        printWindow.close();
    };

    const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
    };

    const finalize = () => {
        const fontSet = printWindow.document.fonts;
        if (fontSet?.ready) {
            fontSet.ready.finally(() => {
                printWindow.setTimeout(triggerPrint, 250);
            });
            return;
        }
        printWindow.setTimeout(triggerPrint, 350);
    };

    if (printWindow.document.readyState === "complete") {
        finalize();
    } else {
        printWindow.onload = finalize;
    }
}
