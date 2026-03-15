"use client";

import React, { useEffect, useState } from "react";
import {
    CheckCircle2,
    ChevronLeft,
    Circle,
    Database,
    History,
    Loader2,
    Menu,
    Mic,
    RefreshCw,
    Search,
    Send,
    Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UploadOverlay from "./UploadOverlay";
import ExecutiveLanding from "./ExecutiveLanding";
import ExecutiveDashboardView from "./ExecutiveDashboardView";
import { DatasetHealth, InsightCard, QueryResponse, UploadResponse } from "@/types";
import { buildApiUrl } from "@/lib/api";

const PLACEHOLDERS = [
    "Show monthly views trend and compare performance by region...",
    "Build an executive dashboard for category performance and sentiment...",
    "Now filter that to ads-enabled videos only and explain what changed...",
];

const DEFAULT_PROMPTS = [
    {
        label: "Step 1: Baseline",
        prompt: "Build an executive dashboard for views, watch time, and estimated revenue by region and category. Highlight the strongest region.",
    },
    {
        label: "Step 2: Ads Filter",
        prompt: "Now filter that dashboard to ads-enabled videos only and explain what changed in the leaders and laggards.",
    },
    {
        label: "Step 3: English Markets",
        prompt: "Now narrow it again to English-language videos and compare North America versus Latin America, then call out what shifted versus the previous view.",
    },
];

interface DatasetState {
    name: string;
    rows: number;
    columns: string[];
    schema: string;
    examplePrompts: string[];
}

interface HistoryEntry {
    query: string;
    response: QueryResponse | null;
    error?: string;
}

function toDatasetState(payload: DatasetHealth | UploadResponse): DatasetState {
    return {
        name: "table" in payload ? payload.table : payload.table_name,
        rows: payload.row_count,
        columns: payload.columns,
        schema: payload.schema,
        examplePrompts: payload.example_prompts,
    };
}

// Global declaration for the SpeechRecognition API interface
// to satisfy TypeScript in components utilizing the API.
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default function Dashboard() {
    const [needsUpload, setNeedsUpload] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [insights, setInsights] = useState<InsightCard[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(true);
    const [activeDataset, setActiveDataset] = useState<DatasetState | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loadingQuery, setLoadingQuery] = useState(false);
    const [activeViewIndex, setActiveViewIndex] = useState<number | null>(null);
    const [openSqlWidgetId, setOpenSqlWidgetId] = useState<string | null>(null);
    const [thinkingStage, setThinkingStage] = useState(0);
    const [isListening, setIsListening] = useState(false);

    const THINKING_STAGES = [
        "Analyzing dataset schema...",
        "Writing SQL query...",
        "Executing against database...",
        "Agentic self-healing...",
        "Rendering charts...",
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDERS.length);
        }, 3200);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        void loadDataset();
        void fetchInsights();
    }, []);

    async function loadDataset() {
        try {
            const response = await fetch(buildApiUrl("/api/health"));
            const data = (await response.json()) as DatasetHealth;

            if (!data.has_data) {
                // Stay on landing, don't force overlay immediately
                setActiveDataset(null);
                return;
            }

            setNeedsUpload(false);
            setActiveDataset(toDatasetState(data));
        } catch {
            setActiveDataset(null);
        }
    }

    async function fetchInsights() {
        try {
            setLoadingInsights(true);
            const response = await fetch(buildApiUrl("/api/insights"));
            const data = await response.json();
            setInsights(data.insights || []);
        } catch {
            setInsights([]);
        } finally {
            setLoadingInsights(false);
        }
    }

    function buildConversationHistory() {
        return history
            .filter((entry) => entry.response || entry.error)
            .flatMap((entry) => {
                const messages = [{ role: "user", content: entry.query }];

                if (entry.response) {
                    messages.push({
                        role: "assistant",
                        content: `Dashboard: ${entry.response.dashboard_title}. Summary: ${entry.response.executive_summary}. Widgets: ${entry.response.widgets.map((widget) => widget.title).join(", ")}.`,
                    });
                } else if (entry.error) {
                    messages.push({ role: "assistant", content: `Error: ${entry.error}` });
                }

                return messages;
            })
            .slice(-8);
    }

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (loadingQuery) {
            setThinkingStage(0);
            const cycleStages = () => {
                setThinkingStage((prev) => {
                    const next = prev + 1;
                    if (next < THINKING_STAGES.length) {
                        timer = setTimeout(cycleStages, next === 1 ? 1500 : next === 2 ? 2000 : next === 3 ? 1500 : 1000);
                        return next;
                    }
                    return prev;
                });
            };
            timer = setTimeout(cycleStages, 1000);
        }
        return () => clearTimeout(timer);
    }, [loadingQuery]);

    const startListening = () => {
        if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        setIsListening(true);

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            setQuery(transcript);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Automatically submit after the microphone turns off if there is text
            // Requires a slight delay to ensure the state caught up
            setTimeout(() => {
                const triggerButton = document.getElementById("hidden-submit-btn");
                if (triggerButton) triggerButton.click();
            }, 300);
        };

        recognition.start();
    };

    async function submitQuery(message: string) {
        const trimmed = message.trim();
        if (!trimmed || loadingQuery || needsUpload) return;

        setQuery("");
        setLoadingQuery(true);
        setOpenSqlWidgetId(null);

        const nextIndex = history.length;
        setHistory((prev) => [...prev, { query: trimmed, response: null }]);
        setActiveViewIndex(nextIndex);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

            const response = await fetch(buildApiUrl("/api/query"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: trimmed,
                    history: buildConversationHistory(),
                }),
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to generate dashboard.");
            }

            setHistory((prev) => {
                const nextHistory = [...prev];
                nextHistory[nextHistory.length - 1].response = data as QueryResponse;
                return nextHistory;
            });
        } catch (error) {
            const err = error as Error;
            setHistory((prev) => {
                const nextHistory = [...prev];
                nextHistory[nextHistory.length - 1].error = err.message;
                return nextHistory;
            });
        } finally {
            setLoadingQuery(false);
        }
    }

    async function handleReset() {
        try {
            const response = await fetch(buildApiUrl("/api/reset"));
            if (!response.ok) return;

            setHistory([]);
            setActiveViewIndex(null);
            setOpenSqlWidgetId(null);
            await loadDataset();
            await fetchInsights();
        } catch {
            // Preserve the current UI state on reset failures.
        }
    }

    function handleUploadSuccess(data: UploadResponse) {
        setNeedsUpload(false);
        setActiveDataset(toDatasetState(data));
        setQuery("");
        setHistory([]);
        setActiveViewIndex(null);
        setOpenSqlWidgetId(null);
        setInsights([]);
    }

    const activeItem = activeViewIndex !== null ? history[activeViewIndex] : null;
    const showBlankUploadedState = Boolean(activeDataset) && history.length === 0;
    const quickPrompts = activeDataset?.examplePrompts.length
        ? activeDataset.examplePrompts
        : [];

    return (
        <div className="app-shell noise-bg min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#030507] to-black text-slate-100 selection:bg-amber-300/30">
            <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_30%)]" />
            {needsUpload && <UploadOverlay onUploadSuccess={handleUploadSuccess} />}
            {sidebarOpen && (
                <button
                    aria-label="Close navigation"
                    className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex min-h-screen">
                <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 w-[85vw] max-w-72 transform border-r border-white/6 bg-[rgba(5,5,8,0.95)] backdrop-blur-2xl transition-transform duration-300 sm:max-w-80 md:w-72 md:translate-x-0 lg:w-80 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <div className="flex h-full flex-col">
                        <div className="border-b border-white/6 px-5 py-4 sm:px-6 sm:py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden p-1.5">
                                            <img src="/images/lumina_logo.png" alt="Lumina Logo" className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold tracking-tight text-white">Lumina</p>
                                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ambient Intelligence</p>
                                        </div>
                                    </div>
                                    <p className="max-w-xs text-sm leading-relaxed text-slate-400">
                                        Turn raw data into executive narratives and board-ready dashboards instantly.
                                    </p>
                                </div>

                                <button
                                    className="rounded-xl border border-white/8 p-2 text-slate-400 transition-colors hover:border-white/15 hover:text-white md:hidden"
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 overflow-y-auto px-5 py-5">
                            <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:rounded-3xl sm:p-5">
                                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                                    <Database className="h-4 w-4" />
                                    Active Dataset
                                </div>

                                {activeDataset ? (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-lg font-semibold capitalize text-white">{activeDataset.name.replace(/_/g, " ")}</p>
                                            <p className="text-sm text-slate-400">{activeDataset.rows.toLocaleString()} rows available</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-[1rem] border border-white/6 bg-slate-900/80 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Columns</p>
                                                <p className="mt-1 text-xl font-semibold text-white">{activeDataset.columns.length}</p>
                                            </div>
                                            <div className="rounded-[1rem] border border-white/6 bg-slate-900/80 p-3">
                                                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Status</p>
                                                <p className="mt-1 text-xl font-semibold text-emerald-300">Live</p>
                                            </div>
                                        </div>

                                        <p className="line-clamp-4 text-sm leading-relaxed text-slate-400">{activeDataset.schema}</p>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
                                        Upload a CSV to start generating dashboards.
                                    </div>
                                )}
                            </div>

                            <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:rounded-3xl sm:p-5">
                                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                                    <History className="h-4 w-4" />
                                    Query History
                                </div>

                                <div className="space-y-2">
                                    {history.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
                                            Your dashboard conversations will appear here.
                                        </div>
                                    ) : (
                                        history.map((entry, index) => (
                                            <button
                                                key={`${entry.query}-${index}`}
                                                onClick={() => setActiveViewIndex(index)}
                                                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${activeViewIndex === index
                                                    ? "border-amber-300/30 bg-amber-300/10 text-white shadow-[0_12px_30px_rgba(245,158,11,0.08)]"
                                                    : "border-white/8 bg-slate-900/70 text-slate-400 hover:border-white/14 hover:text-slate-100"}`}
                                            >
                                                <p className="line-clamp-2 font-medium">{entry.query}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                                                    {entry.response ? "Dashboard ready" : entry.error ? "Needs attention" : "Generating"}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto border-t border-white/6 px-4 py-4 sm:px-5 sm:py-5">
                            <div className="space-y-3">
                                <button
                                    onClick={() => setNeedsUpload(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                                >
                                    <Database className="h-4 w-4" />
                                    Upload New Dataset
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="app-content relative z-10 flex min-h-screen flex-1 flex-col md:pl-72 lg:pl-80">
                    <header className="app-header sticky top-0 z-40 border-b border-white/4 bg-[rgba(5,5,8,0.6)] backdrop-blur-2xl">
                        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
                            <div className="flex items-center gap-3">
                                <button
                                    className="rounded-2xl border border-white/8 p-2 text-slate-300 transition hover:border-white/15 hover:text-white md:hidden"
                                    onClick={() => setSidebarOpen(true)}
                                >
                                    <Menu className="h-5 w-5" />
                                </button>

                                <div className="grid flex-1 gap-3">
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            void submitQuery(query);
                                        }}
                                        className="relative"
                                    >
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                            <Search className="h-5 w-5" />
                                        </div>

                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder={isListening ? "Listening..." : PLACEHOLDERS[placeholderIdx]}
                                            disabled={loadingQuery || needsUpload || isListening}
                                            className="h-12 w-full rounded-[1.25rem] border border-white/8 bg-[rgba(8,10,18,0.8)] pl-11 pr-[7rem] text-[13px] text-white shadow-[0_18px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl outline-none transition-all placeholder:text-slate-500 hover:border-white/15 focus:border-amber-300/40 focus:shadow-[0_0_30px_rgba(245,158,11,0.12)] disabled:opacity-60 sm:h-14 sm:rounded-[1.5rem] sm:pl-12 sm:pr-32 sm:text-[14px]"
                                        />

                                        <div className="absolute right-2 top-2 flex items-center gap-2 sm:right-3 sm:top-2">
                                            <button
                                                type="button"
                                                onClick={startListening}
                                                disabled={loadingQuery || needsUpload}
                                                className={`relative flex h-10 w-10 items-center justify-center rounded-[1.15rem] transition-all sm:h-12 sm:w-12 sm:rounded-2xl ${
                                                    isListening
                                                        ? "bg-rose-500/20 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
                                                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                                } disabled:cursor-not-allowed disabled:opacity-50`}
                                            >
                                                {isListening && (
                                                    <span className="absolute inset-0 animate-ping rounded-[1.15rem] bg-rose-500/40 sm:rounded-2xl" />
                                                )}
                                                <Mic className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="submit"
                                                id="hidden-submit-btn"
                                                disabled={!query.trim() || loadingQuery || needsUpload}
                                                className="flex h-10 w-10 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(135deg,_#f59e0b,_#2563eb)] text-slate-950 shadow-[0_12px_32px_rgba(37,99,235,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none sm:h-12 sm:w-12 sm:rounded-2xl"
                                            >
                                                {loadingQuery ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </form>

                                    {!showBlankUploadedState && (
                                        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                                            {quickPrompts.slice(0, 3).map((prompt) => (
                                                <button
                                                    key={prompt}
                                                    onClick={() => void submitQuery(prompt)}
                                                    disabled={loadingQuery || needsUpload}
                                                    className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-amber-300/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="app-main print-surface mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-3 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
                        <AnimatePresence mode="wait">
                            {loadingQuery && activeItem?.response === null ? (
                                <motion.div 
                                    key="thinking-terminal"
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="flex h-[60vh] flex-col items-center justify-center p-4"
                                >
                                    <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-6 font-mono text-sm shadow-2xl">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                                            <div className="flex gap-1.5">
                                                <div className="h-3 w-3 rounded-full bg-rose-500/50" />
                                                <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                                                <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-widest text-slate-600">Agentic Pipeline v4.0</span>
                                        </div>

                                        <div className="space-y-4">
                                            {THINKING_STAGES.map((stage, index) => {
                                                const isCompleted = index < thinkingStage;
                                                const isActive = index === thinkingStage;
                                                const isPending = index > thinkingStage;

                                                return (
                                                    <div 
                                                        key={stage} 
                                                        className={`flex items-start gap-4 transition-colors duration-500 ${isActive ? "text-amber-400" : isCompleted ? "text-slate-500" : "text-slate-700"}`}
                                                    >
                                                        <div className="mt-0.5 shrink-0">
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            ) : isActive ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                                                            ) : (
                                                                <Circle className="h-4 w-4 text-slate-800" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={`tracking-tight ${isActive ? "animate-pulse font-medium" : ""}`}>
                                                                {stage}
                                                            </span>
                                                            {isActive && (
                                                                <span className="text-[10px] text-slate-500 mt-1 opacity-70">
                                                                    Processing request context...
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1 w-12 rounded-full bg-slate-800 overflow-hidden">
                                                <motion.div 
                                                    className="h-full bg-blue-500"
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: `${(thinkingStage / (THINKING_STAGES.length - 1)) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                                {Math.round((thinkingStage / (THINKING_STAGES.length - 1)) * 100)}% Complete
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : activeItem ? (
                            <ExecutiveDashboardView
                                item={activeItem}
                                openSqlWidgetId={openSqlWidgetId}
                                onToggleSql={(widgetId) => setOpenSqlWidgetId((current) => current === widgetId ? null : widgetId)}
                                onRunPrompt={(prompt) => void submitQuery(prompt)}
                            />
                        ) : showBlankUploadedState ? (
                            <section className="animate-fade-in-up rounded-[1.75rem] border border-white/6 glass-card p-6 shadow-[0_32px_100px_rgba(0,0,0,0.4)] sm:rounded-[2.5rem] sm:p-10">
                                <div className="max-w-3xl space-y-5">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                                        <Database className="h-4 w-4" />
                                        Dataset Loaded
                                    </div>

                                    <div className="space-y-3">
                                        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                                            {activeDataset?.name.replace(/_/g, " ")}
                                        </h1>
                                        <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                                            Your CSV is ready. The dashboard will stay empty until you ask the first question.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
                                        <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Rows</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{activeDataset?.rows.toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Columns</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{activeDataset?.columns.length}</p>
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-400">
                                        Use the search bar above to generate the first dashboard from this dataset.
                                    </p>
                                </div>
                            </section>
                        ) : (
                            <ExecutiveLanding
                                activeDataset={activeDataset}
                                insights={insights}
                                loadingInsights={loadingInsights}
                                promptCards={DEFAULT_PROMPTS}
                                onRunPrompt={(prompt) => void submitQuery(prompt)}
                                onOpenUpload={() => setNeedsUpload(true)}
                            />
                        )}
                        </AnimatePresence>
                    </main>
                </div>
            </div>
        </div>
    );
}
