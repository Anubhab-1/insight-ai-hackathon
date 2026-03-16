"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardRenderer from "./DashboardRenderer";
import { ChartConfig, QueryResponse } from "@/types";
import { downloadWidgetCsv, exportDashboardPdf } from "@/lib/export";
import { ArrowRight, BrainCircuit, CheckCircle2, Download, FileDown, Loader2, ShieldAlert, Sparkles, Zap } from "lucide-react";

/** Render **bold** markdown spans as <strong> elements */
function renderMarkdown(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-violet-300">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

function confidenceClasses(confidence?: string) {
    if (confidence === "high") return "nv-pill-emerald px-4 py-1.5";
    if (confidence === "medium") return "nv-pill-cyan px-4 py-1.5";
    return "nv-pill px-4 py-1.5 border-rose-500/30 text-rose-300 bg-rose-500/5";
}

function widgetConfig(widget: QueryResponse["widgets"][number]): ChartConfig {
    return { type: widget.chart_type, xAxis: widget.x_axis, yAxis: widget.y_axis };
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 20 } }
};

export default function ExecutiveDashboardView({
    item, openSqlWidgetId, onToggleSql, onRunPrompt,
}: {
    item: { query: string; response: QueryResponse | null; error?: string };
    openSqlWidgetId: string | null;
    onToggleSql: (widgetId: string) => void;
    onRunPrompt: (prompt: string) => void;
}) {
    const [exportingWidgetId, setExportingWidgetId] = useState<string | null>(null);
    const [exportMessage, setExportMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

    async function handleWidgetExport(widget: QueryResponse["widgets"][number]) {
        try {
            setExportMessage(null); setExportingWidgetId(widget.id);
            await downloadWidgetCsv(widget);
            setExportMessage({ tone: "success", text: `${widget.title} exported.` });
        } catch (e) { setExportMessage({ tone: "error", text: (e as Error).message }); }
        finally { setExportingWidgetId(null); }
    }

    if (item.error) {
        return (
            <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="nv-card rounded-[2.5rem] border-rose-500/20 bg-rose-500/5 p-8 shadow-[0_40px_100px_rgba(244,63,94,0.15)]">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-400">Neural Link Fault</p>
                        <h2 className="text-2xl font-bold text-white">{item.query}</h2>
                        <p className="max-w-3xl text-sm leading-relaxed text-rose-100/70">{item.error}</p>
                    </div>
                </div>
            </motion.section>
        );
    }

    if (!item.response) return null; // Loading state handled in parent Dashboard.tsx

    if (item.response.cannot_answer) {
        return (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <div className="nv-card rounded-[2.5rem] p-10 shadow-2xl">
                    <h2 className="text-3xl font-bold tracking-tight text-white">{item.query}</h2>
                    <p className="mt-4 text-slate-400">{item.response.dashboard_subtitle || "Request parameters exceeded current dataset scope."}</p>
                </div>
                <div className="nv-card border-amber-500/20 bg-amber-500/5 p-8 rounded-[2.5rem]">
                    <div className="flex items-start gap-4 text-amber-200">
                        <ShieldAlert className="h-6 w-6" />
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/70">Agentic Refusal</p>
                            <p className="text-sm leading-relaxed">{item.response.cannot_answer_reason}</p>
                        </div>
                    </div>
                </div>
            </motion.section>
        );
    }

    return (
        <motion.section variants={containerVariants} initial="hidden" animate="show" className="space-y-10 pb-20">
            {/* Header / Executive Summary */}
            <motion.div variants={itemVariants} className="nv-card print-card rounded-[2.5rem] p-8 shadow-2xl sm:p-12">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-4xl space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.24em] nv-pill">
                            <BrainCircuit className="h-3.5 w-3.5" /> Executive Intelligence Synthesis
                        </div>
                        <h2 className="nv-gradient-text text-3xl font-bold tracking-tight sm:text-5xl">
                            {item.response.dashboard_title}
                        </h2>
                        {/* AI Narrative with markdown bold support */}
                        <div className="rounded-2xl border-l-4 p-4 sm:p-5" style={{ borderColor: "rgba(139,92,246,0.5)", background: "rgba(139,92,246,0.05)" }}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#7c6fa0" }}>AI Synthesis</p>
                            <p className="text-sm leading-relaxed text-slate-200 sm:text-base sm:leading-8">
                                {renderMarkdown(item.response.executive_summary)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row lg:flex-col lg:items-end">
                        <div className={`rounded-full text-[11px] font-bold uppercase tracking-widest ${confidenceClasses(item.response.confidence)}`}>
                            {item.response.confidence || "Low"} confidence
                        </div>
                        <button onClick={() => exportDashboardPdf(item.response?.dashboard_title || "")}
                            className="nv-pill-cyan flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                            <FileDown className="h-4 w-4" /> Export Briefing
                        </button>
                    </div>
                </div>
            </motion.div>

            {exportMessage && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border px-5 py-3 text-xs font-medium ${exportMessage.tone === "error" ? "nv-pill bg-rose-500/5 text-rose-300 border-rose-500/20" : "nv-pill-emerald"}`}>
                    {exportMessage.text}
                </motion.div>
            )}

            {/* KPI Grid */}
            {item.response.kpis.length > 0 && (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
                    {item.response.kpis.map((kpi, idx) => (
                        <motion.div key={kpi.title} variants={itemVariants}
                            className="nv-card nv-card-hover rounded-3xl p-6 shadow-xl relative group">
                            {/* Accent highlight */}
                            <div className="absolute top-0 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: `linear-gradient(90deg, transparent, ${idx % 2 === 0 ? "#8b5cf6" : "#06b6d4"}, transparent)` }} />
                            
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{kpi.title}</p>
                            <p className="mt-2 text-3xl font-bold tracking-tight text-white">{kpi.value}</p>
                            {kpi.insight && <p className="mt-3 text-[11px] leading-relaxed text-slate-500 line-clamp-2 italic">{kpi.insight}</p>}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bento Charts */}
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {item.response.widgets.map((w, idx) => {
                    const isWide = ["line", "area", "multi_line", "treemap", "table"].includes(w.chart_type);
                    return (
                        <motion.article key={w.id} variants={itemVariants}
                            className={`nv-card nv-card-hover print-card flex flex-col rounded-[2.5rem] overflow-hidden ${isWide ? "xl:col-span-2" : "xl:col-span-1"}`}>
                            
                            <div className="border-b px-8 py-6" style={{ borderColor: "rgba(139,92,246,0.06)", background: "rgba(139,92,246,0.02)" }}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="nv-pill-cyan inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                                            {w.chart_type} projection
                                        </div>
                                        <h3 className="text-xl font-bold text-white">{w.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleWidgetExport(w)} disabled={exportingWidgetId === w.id}
                                            className="nv-pill-emerald flex h-9 items-center gap-2 rounded-xl px-4 text-[10px] font-bold transition-all disabled:opacity-50">
                                            {exportingWidgetId === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
                                        </button>
                                        <button onClick={() => onToggleSql(w.id)}
                                            className="nv-pill flex h-9 items-center rounded-xl px-4 text-[10px] font-bold transition-all">
                                            {openSqlWidgetId === w.id ? "Hide Source" : "Intelligence Source"}
                                        </button>
                                    </div>
                                </div>
                                {w.insight && <p className="mt-3 text-xs leading-relaxed text-slate-400/80 italic">{w.insight}</p>}
                            </div>

                            <div className="flex-1 p-8">
                                <div className="h-[360px] w-full">
                                    <DashboardRenderer data={w.data} config={widgetConfig(w)} />
                                </div>

                                <AnimatePresence>
                                    {openSqlWidgetId === w.id && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                            className="mt-6 overflow-hidden rounded-2xl border bg-[#05040d]" style={{ borderColor: "rgba(139,92,246,0.1)" }}>
                                            <div className="border-b px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500" style={{ background: "rgba(139,92,246,0.04)", borderColor: "rgba(139,92,246,0.1)" }}>
                                                Executed Neural SQL
                                            </div>
                                            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-emerald-400/80">
                                                <code>{w.sql}</code>
                                            </pre>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.article>
                    );
                })}
            </div>

            {/* Recommendations & Follow-ups */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <motion.div variants={itemVariants} className="nv-card rounded-[2.5rem] p-8 lg:p-10">
                    <div className="mb-8 flex items-center gap-4">
                        <div className="nv-glow flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Advisory</p>
                            <h3 className="text-xl font-bold text-white">Recommended Actions</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {item.response.recommendations.map((r, i) => (
                            <div key={i} className="group flex gap-4 p-3 rounded-2xl transition-all hover:bg-violet-500/5">
                                <div className="mt-1 h-6 w-6 shrink-0 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-500 group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-all">
                                    {i + 1}
                                </div>
                                <p className="text-sm leading-relaxed text-slate-300 group-hover:text-white transition-colors">{r}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="nv-card rounded-[2.5rem] p-8 lg:p-10">
                    <div className="mb-8 flex items-center gap-4">
                        <div className="nv-glow flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 border border-violet-500/25">
                            <Sparkles className="h-6 w-6 text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Exploration</p>
                            <h3 className="text-xl font-bold text-white">Neural Forecasts</h3>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {item.response.follow_up_questions.map((q) => (
                            <button key={q} onClick={() => onRunPrompt(q)}
                                className="group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/5 hover:shadow-xl"
                                style={{ borderColor: "rgba(139,92,246,0.12)", background: "rgba(139,92,246,0.02)" }}>
                                <span className="pr-4 text-sm leading-relaxed text-slate-300 group-hover:text-white transition-colors">{q}</span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:translate-x-1 group-hover:text-violet-400 transition-all" />
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.section>
    );
}
