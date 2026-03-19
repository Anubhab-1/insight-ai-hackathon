"use client";

import React, { useEffect, useEffectEvent, useState } from "react";
import Image from "next/image";
import {
    CheckCircle2,
    ChevronLeft,
    Database,
    History,
    Loader2,
    Menu,
    Mic,
    RefreshCw,
    Search,
    Send,
    Sparkles,
    Zap,
    Hash,
    Calendar,
    Tag,
    MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UploadOverlay from "./UploadOverlay";
import ExecutiveLanding from "./ExecutiveLanding";
import ExecutiveDashboardView from "./ExecutiveDashboardView";
import { DatasetHealth, DatasetRecord, InsightCard, QueryResponse, UploadResponse } from "@/types";
import { buildApiUrl } from "@/lib/api";

const PLACEHOLDERS = [
    "Analyze monthly revenue trends by region...",
    "Build a category performance dashboard...",
    "Explain why the North American segment shifted...",
];

const DEFAULT_PROMPTS = [
    { label: "Step 1: Baseline", prompt: "Build an executive dashboard for views, watch time, and estimated revenue by region. Highlight the strongest region." },
    { label: "Step 2: Analysis", prompt: "Now filter that dashboard to ads-enabled videos only and explain the variance in revenue leaders." },
    { label: "Step 3: Comparison", prompt: "Compare North America vs Latin America watch time and call out the primary shifting metrics." },
];

const THINKING_STAGES = [
    "Analyzing dataset schema...",
    "Writing SQL query...",
    "Executing against database...",
    "Validating results...",
    "Rendering charts...",
];

type ConversationMessage = {
    role: "user" | "assistant";
    content: string;
};

interface SpeechRecognitionAlternativeLike {
    transcript: string;
}

interface SpeechRecognitionResultLike {
    0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
    [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionLike;
}

type SpeechWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface DatasetState {
    name: string;
    rows: number;
    columns: string[];
    schema: string;
    examplePrompts: string[];
    sampleData: DatasetRecord[];
    llmAvailable: boolean;
}

interface HistoryEntry {
    query: string;
    response: QueryResponse | null;
    error?: string;
}

function toDatasetState(payload: DatasetHealth | UploadResponse): DatasetState {
    const rawName = "table" in payload ? payload.table : payload.table_name;

    return {
        name: typeof rawName === "string" && rawName.trim() ? rawName : "dataset",
        rows: payload.row_count,
        columns: Array.isArray(payload.columns) ? payload.columns : [],
        schema: payload.schema || "Schema unavailable.",
        examplePrompts: Array.isArray(payload.example_prompts) ? payload.example_prompts : [],
        sampleData: Array.isArray(payload.sample_data) ? payload.sample_data : [],
        llmAvailable: Boolean(payload.llm_client),
    };
}

function safeJsonParse<T>(text: string, context: string): T | null {
    try { return JSON.parse(text) as T; } 
    catch (e) { console.error(`${context} parse failed:`, e); return null; }
}

function getColumnBadgeMeta(column: string) {
    if (/(date|time|month|year|published|created)/i.test(column)) {
        return {
            icon: Calendar,
            background: "rgba(6,182,212,0.15)",
            border: "rgba(6,182,212,0.2)",
        };
    }

    if (/(revenue|count|score|rate|views|likes|shares|amount|sales|profit|duration|hours|seconds|usd|gained)/i.test(column)) {
        return {
            icon: Hash,
            background: "rgba(16,185,129,0.15)",
            border: "rgba(16,185,129,0.2)",
        };
    }

    return {
        icon: Tag,
        background: "rgba(139,92,246,0.1)",
        border: "rgba(139,92,246,0.15)",
    };
}

export default function Dashboard() {
    const [needsUpload, setNeedsUpload] = useState(true);
    const [checkingDataset, setCheckingDataset] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [insights, setInsights] = useState<InsightCard[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [activeDataset, setActiveDataset] = useState<DatasetState | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loadingQuery, setLoadingQuery] = useState(false);
    const [activeViewIndex, setActiveViewIndex] = useState<number | null>(null);
    const [openSqlWidgetId, setOpenSqlWidgetId] = useState<string | null>(null);
    const [thinkingStage, setThinkingStage] = useState(0);
    const [isListening, setIsListening] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDERS.length);
        }, 3200);
        return () => clearInterval(interval);
    }, []);

    const loadDataset = useEffectEvent(async () => {
        try {
            const res = await fetch(buildApiUrl("/api/health"));
            const text = await res.text();
            if (!res.ok) {
                setNeedsUpload(true);
                setActiveDataset(null);
                setInsights([]);
                return;
            }
            const data = safeJsonParse<DatasetHealth>(text, "Health");
            if (!data || !data.has_data) {
                setNeedsUpload(true);
                setActiveDataset(null);
                setInsights([]);
                return;
            }

            const dataset = toDatasetState(data);
            setNeedsUpload(false);
            setActiveDataset(dataset);

            if (dataset.llmAvailable) {
                void fetchInsights();
            } else {
                setInsights([]);
            }
        } catch {
            setNeedsUpload(true);
            setActiveDataset(null);
            setInsights([]);
        } finally {
            setCheckingDataset(false);
        }
    });

    async function fetchInsights() {
        try {
            setLoadingInsights(true);
            const res = await fetch(buildApiUrl("/api/insights"));
            const data = await res.json();
            setInsights(data?.insights || []);
        } catch { setInsights([]); }
        finally { setLoadingInsights(false); }
    }

    useEffect(() => {
        void loadDataset();
    }, []);

    function buildConversationHistory(): ConversationMessage[] {
        return history.filter(h => h.response || h.error).flatMap((h): ConversationMessage[] => {
            const messages: ConversationMessage[] = [{ role: "user", content: h.query }];
            if (h.response) messages.push({ role: "assistant", content: `Title: ${h.response.dashboard_title}. Summary: ${h.response.executive_summary}.` });
            else if (h.error) messages.push({ role: "assistant", content: `Error: ${h.error}` });
            return messages;
        }).slice(-6);
    }

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (loadingQuery) {
            setThinkingStage(0);
            const cycle = () => {
                setThinkingStage(p => {
                    if (p < THINKING_STAGES.length - 1) {
                        timer = setTimeout(cycle, 1500);
                        return p + 1;
                    }
                    return p;
                });
            };
            timer = setTimeout(cycle, 1000);
        }
        return () => clearTimeout(timer);
    }, [loadingQuery]);

    const startListening = () => {
        const speechWindow = window as SpeechWindow;
        const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
        if (!SR) return alert("Speech Recognition not supported");
        const rec = new SR();
        rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
        setIsListening(true);
        rec.onresult = (event) => setQuery(event.results[event.resultIndex][0].transcript);
        rec.onerror = () => setIsListening(false);
        rec.onend = () => { setIsListening(false); setTimeout(() => document.getElementById("hidden-submit-btn")?.click(), 400); };
        rec.start();
    };

    async function submitQuery(msg: string) {
        const t = msg.trim();
        if (!t || loadingQuery || needsUpload) return;
        setQuery(""); setLoadingQuery(true); setOpenSqlWidgetId(null);
        const idx = history.length;
        setHistory(p => [...p, { query: t, response: null }]);
        setActiveViewIndex(idx);
        try {
            const res = await fetch(buildApiUrl("/api/query"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: t, history: buildConversationHistory() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Query failed");
            setHistory(p => { const h = [...p]; h[h.length - 1].response = data; return h; });
        } catch (e) {
            setHistory(p => { const h = [...p]; h[h.length - 1].error = (e as Error).message; return h; });
        } finally { setLoadingQuery(false); }
    }

    function handleUploadSuccess(data: UploadResponse) {
        const dataset = toDatasetState(data);
        setNeedsUpload(false); setActiveDataset(dataset);
        setQuery(""); setHistory([]); setActiveViewIndex(null);
        setOpenSqlWidgetId(null);
        if (dataset.llmAvailable) void fetchInsights();
        else setInsights([]);
    }

    const activeItem = activeViewIndex !== null ? history[activeViewIndex] : null;
    const isShowingRawDataset = Boolean(activeDataset && history.length === 0);
    const previewColumns = Object.keys(activeDataset?.sampleData[0] || {});

    if (!isClient || checkingDataset) {
        return (
            <div className="nv-bg flex min-h-screen items-center justify-center px-6">
                <div className="nv-card flex max-w-md items-center gap-5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent animate-scanline" />
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
                    </div>
                    <div>
                        <p className="text-base font-bold text-white tracking-tight">Initializing Workspace</p>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">Securing your neural connection and restoring the latest data insights.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="nv-bg app-shell min-h-screen">
            {needsUpload && <UploadOverlay onUploadSuccess={handleUploadSuccess} />}
            
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md md:hidden"
                        onClick={() => setSidebarOpen(false)} />
                )}
            </AnimatePresence>

            <div className="flex min-h-screen">
                {/* ── Sidebar ── */}
                <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 w-72 transform border-r transition-all duration-500 ease-in-out md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                    style={{ background: "#090714", borderColor: "rgba(139,92,246,0.12)" }}>
                    
                    {/* Animated Data Matrix Lines Background */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
                        <div className="absolute left-8 h-full w-[1px] bg-gradient-to-b from-transparent via-violet-500/40 to-transparent" style={{ animation: "data-flow 3s linear infinite" }} />
                        <div className="absolute left-1/2 h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" style={{ animation: "data-flow 4s linear infinite 1s" }} />
                        <div className="absolute right-8 h-full w-[1px] bg-gradient-to-b from-transparent via-fuchsia-500/40 to-transparent" style={{ animation: "data-flow 3.5s linear infinite 0.5s" }} />
                    </div>

                    <div className="relative z-10 flex h-full flex-col">
                        {/* Sidebar Header */}
                        <div className="px-6 py-6" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="nv-glow flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30 overflow-hidden p-1.5">
                                        <Image src="/images/lumina_logo.png" alt="Lumina logo" width={28} height={28} className="h-full w-full object-contain" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold tracking-tight text-white">Lumina</p>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7c6fa0" }}>Executive Console</p>
                                    </div>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="rounded-xl border p-2 md:hidden" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
                                    <ChevronLeft className="h-4 w-4 text-violet-300" />
                                </button>
                            </div>
                        </div>

                        {/* Sidebar Content */}
                        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
                            {/* Dataset Info */}
                            <div className="nv-card rounded-3xl p-5 shadow-2xl">
                                <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7c6fa0" }}>
                                    <Database className="h-3.5 w-3.5" /> Active Source
                                </div>
                            {activeDataset ? (
                                    <div className="space-y-3">
                                        <p className="text-base font-bold capitalize text-white">{activeDataset.name.replace(/_/g, " ")}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-2xl p-2.5 text-center" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)" }}>
                                                <p className="text-[9px] uppercase tracking-widest text-slate-500">Rows</p>
                                                <p className="text-sm font-bold text-white">{activeDataset.rows.toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-2xl p-2.5 text-center" style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.1)" }}>
                                                <p className="text-[9px] uppercase tracking-widest text-slate-500">Cols</p>
                                                <p className="text-sm font-bold text-white">{activeDataset.columns.length}</p>
                                            </div>
                                        </div>
                                        {/* Column type badges */}
                                        <div className="pt-1 space-y-2">
                                            <p className="text-[9px] uppercase tracking-widest text-slate-600">Schema</p>
                                            <div className="flex flex-wrap gap-1">
                                                {activeDataset.columns.slice(0, 16).map(col => {
                                                    const badge = getColumnBadgeMeta(col);
                                                    const Icon = badge.icon;
                                                    const background = badge.background;
                                                    const border = badge.border;
                                                    const label = col.replace(/_/g, " ");
                                                    return (
                                                        <span key={col} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium text-white/70"
                                                            style={{ background, border: `1px solid ${border}` }}>
                                                            <Icon className="h-3 w-3" />
                                                            {label}
                                                        </span>
                                                    );
                                                })}
                                                {activeDataset.columns.length > 16 && (
                                                    <span className="rounded-full px-2 py-0.5 text-[9px] text-slate-600" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        +{activeDataset.columns.length - 16} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs italic" style={{ color: "#7c6fa0" }}>Connect a dataset to begin.</p>
                                )}
                            </div>

                            {/* Query History */}
                            <div className="space-y-4">
                                <p className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7c6fa0" }}>
                                    <History className="h-3.5 w-3.5" /> Query History
                                </p>
                                <div className="space-y-2">
                                    {history.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-4 text-center text-xs" style={{ borderColor: "rgba(139,92,246,0.1)", color: "#4d4270" }}>
                                            No active inquiries.
                                        </div>
                                    ) : (
                                        history.map((h, i) => (
                                            <button key={i} onClick={() => setActiveViewIndex(i)}
                                                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 ${activeViewIndex === i ? "border-violet-500/40 bg-violet-500/10 shadow-lg" : "border-violet-500/5 bg-white/2 hover:border-violet-500/20"}`}>
                                                <p className="text-xs font-semibold text-white/90 line-clamp-1">{h.query}</p>
                                                <p className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: activeViewIndex === i ? "#c4b5fd" : "#4d4270" }}>
                                                    {h.response ? "Ready" : h.error ? "Request Failed" : "Processing"}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Footer */}
                        <div className="px-5 py-5" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
                            <button onClick={() => setNeedsUpload(true)}
                                className="liquid-btn group flex w-full items-center justify-center gap-2.5 rounded-2xl p-3 text-xs font-bold text-white transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                                <RefreshCw className="h-4 w-4 text-violet-400 group-hover:scale-110 transition-transform" />
                                Re-sync Dataset
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ── Main Content Area ── */}
                <div className="relative z-10 flex min-h-screen flex-1 flex-col transition-all duration-500 md:pl-72">
                    
                    {/* Header: Chat Search Bar */}
                    <header className="app-header sticky top-0 z-30 px-4 py-4 backdrop-blur-3xl sm:px-8 sm:py-6" style={{ background: "rgba(4,3,10,0.6)", borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
                        <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
                            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl border" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
                                <Menu className="h-5 w-5 text-violet-400" />
                            </button>

                            <form onSubmit={e => { e.preventDefault(); void submitQuery(query); }} className="relative flex-1 group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                                    <Search className="h-5 w-5 text-violet-500/60 group-focus-within:text-violet-400 transition-colors" />
                                </div>
                                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                                    placeholder={isListening ? "Listening..." : PLACEHOLDERS[placeholderIdx]}
                                    disabled={loadingQuery || needsUpload || isListening}
                                    className="h-14 w-full rounded-2xl border bg-surface/50 pl-14 pr-32 text-sm text-white shadow-2xl backdrop-blur-xl outline-none transition-all placeholder:text-slate-600 focus:border-violet-500/50 focus:shadow-[0_0_40px_rgba(139,92,246,0.15)] disabled:opacity-50"
                                    style={{ borderColor: "rgba(139,92,246,0.12)" }} />
                                
                                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                                    <button type="button" onClick={startListening} disabled={loadingQuery || needsUpload}
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${isListening ? "bg-rose-500/20 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.4)]" : "bg-white/5 text-violet-400 hover:bg-white/10"}`}>
                                        <Mic className={`h-5 w-5 ${isListening ? "animate-pulse" : ""}`} />
                                    </button>
                                    <button type="submit" id="hidden-submit-btn" disabled={!query.trim() || loadingQuery || needsUpload}
                                        className="nv-btn-primary flex h-10 w-10 items-center justify-center rounded-xl text-white disabled:bg-slate-800 disabled:opacity-40">
                                        {loadingQuery ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </button>
                                </div>
                            </form>

                            {/* Context turn count badge */}
                            {history.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
                                    <MessageSquare className="h-3 w-3" />
                                    {history.length} turn{history.length !== 1 ? 's' : ''} active
                                </div>
                            )}
                        </div>

                        {/* Example prompt chips shown only before the first query */}
                        {activeDataset && history.length === 0 && activeDataset.examplePrompts.length > 0 && (
                            <div className="mx-auto mt-3 flex w-full max-w-6xl flex-wrap gap-2 px-0">
                                {activeDataset.examplePrompts.map((p, i) => (
                                    <button key={i} onClick={() => void submitQuery(p)}
                                        className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold transition-all hover:scale-105"
                                        style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: '#c4b5fd' }}>
                                        <Sparkles className="h-3 w-3" />
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                    </header>

                    {/* Dashboard Main Scroll Surface */}
                    <main className="app-main print-surface mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-8">
                        <AnimatePresence mode="wait">
                            {loadingQuery && !activeItem?.response ? (
                                <motion.div key="thinking" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                    className="flex h-[60vh] flex-col items-center justify-center gap-10">
                                    
                                    {/* Neural Pulse loading animation */}
                                    <div className="relative h-48 w-48 flex items-center justify-center">
                                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                            className="absolute inset-0 rounded-full bg-violet-500/10 blur-3xl" />
                                        
                                        <div className="absolute inset-0 rounded-full border border-violet-500/30" style={{ animation: "pulse-ring 2.5s ease-out infinite" }} />
                                        <div className="absolute inset-6 rounded-full border border-cyan-500/20" style={{ animation: "pulse-ring 2.5s ease-out infinite 0.6s" }} />
                                        <div className="absolute inset-12 rounded-full border border-fuchsia-500/15" style={{ animation: "pulse-ring 2.5s ease-out infinite 1.2s" }} />
                                        
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/20" />

                                        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_0_50px_rgba(139,92,246,0.6)]">
                                            <Zap className="h-8 w-8 text-white animate-pulse" />
                                        </div>
                                    </div>

                                    <div className="w-full max-w-sm space-y-6">
                                        <div className="space-y-2 text-center">
                                            <h3 className="nv-gradient-text text-2xl font-black tracking-tight">Synthesizing Intel</h3>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400/50">Processing your inquiry across the dataset</p>
                                        </div>
                                        <div className="space-y-5 rounded-[2rem] border p-8 nv-card-premium shadow-2xl relative overflow-hidden" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-scanline" />
                                            {THINKING_STAGES.map((s, i) => (
                                                <div key={s} className={`flex items-center gap-4 transition-all duration-500 ${i === thinkingStage ? "text-white scale-105 translate-x-2" : i < thinkingStage ? "text-violet-400/40" : "text-slate-800"}`}>
                                                    <div className="relative flex h-5 w-5 items-center justify-center">
                                                        {i < thinkingStage ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        ) : i === thinkingStage ? (
                                                            <>
                                                                <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
                                                                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                                                            </>
                                                        ) : (
                                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-800" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-bold tracking-wide">{s}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : activeItem ? (
                                <ExecutiveDashboardView key={activeItem.query} item={activeItem} openSqlWidgetId={openSqlWidgetId}
                                    onToggleSql={id => setOpenSqlWidgetId(c => c === id ? null : id)}
                                    onRunPrompt={p => void submitQuery(p)} />
                            ) : isShowingRawDataset && activeDataset ? (
                                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                                    <div className="nv-card rounded-[2.5rem] p-10 shadow-2xl text-center">
                                        <div className="nv-glow mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/25">
                                            <Database className="h-10 w-10 text-emerald-400" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                            Dataset Ready.
                                        </h1>
                                        <p className="mx-auto mt-4 max-w-xl text-slate-400">
                                            Your dataset <span className="text-violet-300 font-semibold">{activeDataset.name}</span> is indexed.
                                            Ask a business question above to generate your first executive briefing.
                                        </p>
                                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                                            <span className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${activeDataset.llmAvailable ? "nv-pill-emerald" : "nv-pill-cyan"}`}>
                                                {activeDataset.llmAvailable ? "LLM connected" : "Local fallback ready"}
                                            </span>
                                            <span className="rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300"
                                                style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.04)" }}>
                                                {activeDataset.rows.toLocaleString()} rows · {activeDataset.columns.length} columns
                                            </span>
                                        </div>
                                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                                            {activeDataset.examplePrompts.map((p) => (
                                                <button key={p} onClick={() => void submitQuery(p)}
                                                    className="nv-pill flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all hover:bg-violet-500/20">
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                        <section className="nv-card rounded-[2rem] p-6 sm:p-8">
                                            <div className="mb-5 flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                                                    <Hash className="h-5 w-5 text-violet-300" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#7c6fa0" }}>Schema Snapshot</p>
                                                    <h2 className="text-xl font-semibold text-white">Column Inventory</h2>
                                                </div>
                                            </div>
                                            <p className="rounded-2xl border px-4 py-3 text-xs leading-relaxed text-slate-400"
                                                style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.03)" }}>
                                                {activeDataset.schema}
                                            </p>
                                            <div className="mt-5 flex flex-wrap gap-2">
                                                {activeDataset.columns.map((column) => {
                                                    const badge = getColumnBadgeMeta(column);
                                                    const Icon = badge.icon;
                                                    return (
                                                        <span key={column} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white/80"
                                                            style={{ background: badge.background, border: `1px solid ${badge.border}` }}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                            {column.replace(/_/g, " ")}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section className="nv-card rounded-[2rem] p-6 sm:p-8">
                                            <div className="mb-5 flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                                                    <Database className="h-5 w-5 text-cyan-300" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#7c6fa0" }}>Sample Preview</p>
                                                    <h2 className="text-xl font-semibold text-white">First Rows</h2>
                                                </div>
                                            </div>

                                            {activeDataset.sampleData.length > 0 ? (
                                                <div className="overflow-hidden rounded-2xl border border-violet-500/10 bg-[#05040d]">
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full text-left text-xs text-slate-300">
                                                            <thead className="bg-violet-500/5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
                                                                <tr>
                                                                    {previewColumns.map((column) => (
                                                                        <th key={column} className="px-4 py-3 font-bold">
                                                                            {column.replace(/_/g, " ")}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-violet-500/5">
                                                                {activeDataset.sampleData.map((row, rowIndex) => (
                                                                    <tr key={`sample-row-${rowIndex}`} className="hover:bg-violet-500/5">
                                                                        {previewColumns.map((column) => (
                                                                            <td key={`${rowIndex}-${column}`} className="px-4 py-3 align-top text-white/85">
                                                                                {row[column] === null || row[column] === undefined || row[column] === "" ? "-" : String(row[column])}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-slate-500"
                                                    style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.02)" }}>
                                                    Sample rows will appear here after upload.
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </motion.section>
                            ) : (
                                <ExecutiveLanding key="landing" activeDataset={activeDataset} insights={insights} loadingInsights={loadingInsights}
                                    promptCards={DEFAULT_PROMPTS} onRunPrompt={p => void submitQuery(p)} onOpenUpload={() => setNeedsUpload(true)} />
                            )}
                        </AnimatePresence>
                    </main>
                </div>
            </div>
        </div>
    );
}

