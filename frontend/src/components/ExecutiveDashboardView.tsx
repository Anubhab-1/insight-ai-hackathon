"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardRenderer from "./DashboardRenderer";
import { ChartConfig, QueryResponse } from "@/types";
import { downloadWidgetCsv, exportDashboardPdf } from "@/lib/export";
import { explainChart } from "@/lib/api";
import { ArrowRight, BrainCircuit, CheckCircle2, Download, FileDown, Loader2, ShieldAlert, Sparkles } from "lucide-react";

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

    // Chart Explanation State
    const [explainingWidgetId, setExplainingWidgetId] = useState<string | null>(null);
    const [chartExplanations, setChartExplanations] = useState<Record<string, string>>({});

    async function handleWidgetExport(widget: QueryResponse["widgets"][number]) {
        try {
            setExportMessage(null); setExportingWidgetId(widget.id);
            await downloadWidgetCsv(widget);
            setExportMessage({ tone: "success", text: `${widget.title} exported.` });
        } catch (e) { setExportMessage({ tone: "error", text: (e as Error).message }); }
        finally { setExportingWidgetId(null); }
    }

    const handleExplainChart = async (w: QueryResponse["widgets"][number]) => {
        if (chartExplanations[w.id]) {
            // Toggle off if already open
            setChartExplanations(prev => {
                const updated = { ...prev };
                delete updated[w.id];
                return updated;
            });
            return;
        }

        setExplainingWidgetId(w.id);
        try {
            const res = await explainChart({
                title: w.title,
                chart_type: w.chart_type,
                data: w.data,
                insight: w.insight ?? undefined
            });
            setChartExplanations(prev => ({ ...prev, [w.id]: res.explanation }));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to explain chart.";
            console.error("Explain Chart error", err);
            setExportMessage({ tone: "error", text: message });
        } finally {
            setExplainingWidgetId(null);
        }
    };

    if (item.error) {
        return (
            <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="nv-card rounded-[2.5rem] border-rose-500/20 bg-rose-500/5 p-8 shadow-[0_40px_100px_rgba(244,63,94,0.15)]">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-400">Request Failed</p>
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
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/70">Out Of Scope</p>
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
            <motion.div variants={itemVariants} className="nv-card-premium print-card rounded-[2.5rem] p-8 shadow-2xl sm:p-12 relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-violet-600/10 blur-[80px] group-hover:bg-violet-600/20 transition-colors duration-700" />
                
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between relative z-10">
                    <div className="max-w-4xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.24em] nv-pill border-glow-violet">
                                <BrainCircuit className="h-3.5 w-3.5" /> Executive Briefing
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <Sparkles className="h-3 w-3" /> Hackathon Demo
                            </div>
                        </div>
                        <h2 className="nv-gradient-text text-3xl font-bold tracking-tight sm:text-5xl leading-[1.1]">
                            {item.response.dashboard_title}
                        </h2>
                        {/* AI Narrative with markdown bold support */}
                        <div className="rounded-3xl border border-violet-500/10 p-6 sm:p-8 bg-violet-500/[0.03] backdrop-blur-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-fuchsia-500 opacity-50" />
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400/70">Strategic Insight</p>
                            <p className="text-sm leading-relaxed text-slate-200 sm:text-lg sm:leading-9 font-medium">
                                {renderMarkdown(item.response.executive_summary)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row lg:flex-col lg:items-end pt-4">
                        <div className={`rounded-full text-[11px] font-bold uppercase tracking-widest shadow-lg ${confidenceClasses(item.response.confidence)}`}>
                            {item.response.confidence || "Low"} confidence
                        </div>
                        <button onClick={() => exportDashboardPdf(item.response?.dashboard_title || "")}
                            className="nv-btn-primary flex items-center justify-center gap-3 rounded-full px-8 py-3.5 text-xs font-bold text-white transition-all">
                            <FileDown className="h-4 w-4" /> Export Report
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
                            className="nv-card nv-card-hover rounded-[2rem] p-8 shadow-xl relative group overflow-hidden">
                            {/* Animated hover highlight */}
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                            
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 relative z-10">{kpi.title}</p>
                            <p className="mt-3 text-4xl font-black tracking-tight text-white relative z-10">{kpi.value}</p>
                            {kpi.insight && <p className="mt-4 text-[11px] leading-relaxed text-slate-400 line-clamp-2 italic font-medium relative z-10">{kpi.insight}</p>}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bento Charts */}
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {item.response.widgets.map((w) => {
                    const isWide = ["line", "area", "multi_line", "treemap", "table"].includes(w.chart_type);
                    // Adaptive chart height based on type and data rows
                    const chartHeight = (() => {
                        if (w.chart_type === "table") return Math.min(80 + (w.data?.length ?? 10) * 42, 560);
                        if (w.chart_type === "pie" || w.chart_type === "treemap") return 320;
                        if (["line", "area", "multi_line"].includes(w.chart_type)) return 380;
                        if (w.chart_type === "stacked_bar" || w.chart_type === "bar") return Math.min(300 + (w.data?.length ?? 8) * 14, 420);
                        return 360;
                    })();
                    return (
                        <motion.article key={w.id} variants={itemVariants}
                            className={`nv-card-premium nv-card-hover print-card flex flex-col rounded-[2.5rem] overflow-hidden ${isWide ? "xl:col-span-2" : "xl:col-span-1"} group`}>
                            
                            <div className="border-b px-8 py-7" style={{ borderColor: "rgba(139,92,246,0.1)", background: "linear-gradient(90deg, rgba(139,92,246,0.05), transparent)" }}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1.5">
                                        <div className="nv-pill-cyan inline-flex rounded-full px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-cyan-500/20">
                                            {w.chart_type.replace('_', ' ')}
                                        </div>
                                        <h3 className="text-2xl font-black tracking-tight text-white group-hover:text-violet-200 transition-colors">{w.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <button onClick={() => handleExplainChart(w)} disabled={explainingWidgetId === w.id}
                                            className={`nv-pill-violet flex h-10 items-center gap-2 rounded-xl px-5 text-[10px] font-bold transition-all disabled:opacity-50 ${chartExplanations[w.id] ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]' : 'hover:bg-violet-500/20'}`}>
                                            {explainingWidgetId === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {chartExplanations[w.id] ? 'Close Explainer' : 'AI Analysis'}
                                        </button>
                                        <button onClick={() => handleWidgetExport(w)} disabled={exportingWidgetId === w.id}
                                            className="nv-pill-emerald flex h-10 items-center gap-2 rounded-xl px-5 text-[10px] font-bold transition-all disabled:opacity-50 hidden sm:flex hover:bg-emerald-500/20">
                                            {exportingWidgetId === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
                                        </button>
                                        <button onClick={() => onToggleSql(w.id)}
                                            className="nv-pill flex h-10 items-center rounded-xl px-5 text-[10px] font-bold transition-all hover:bg-white/5">
                                            {openSqlWidgetId === w.id ? "Hide SQL" : "View SQL"}
                                        </button>
                                    </div>
                                </div>
                                {w.insight && (
                                    <div className="mt-4 flex gap-3 items-start p-3 rounded-2xl bg-violet-500/5 border border-violet-500/10">
                                        <Sparkles className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                                        <p className="text-xs leading-relaxed text-slate-300 italic">{w.insight}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 p-8">
                                <div style={{ height: `${chartHeight}px` }} className="w-full">
                                    <DashboardRenderer data={w.data} config={widgetConfig(w)} />
                                </div>

                                <AnimatePresence>
                                    {chartExplanations[w.id] && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                            className="mb-6 rounded-2xl border-l-4 border-violet-500 bg-violet-500/10 p-5 shadow-lg">
                                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-400">
                                                <Sparkles className="h-4 w-4" /> Chart Notes
                                            </div>
                                            <div className="text-sm leading-relaxed text-slate-200">
                                                {renderMarkdown(chartExplanations[w.id])}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {openSqlWidgetId === w.id && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                            className="mt-6 overflow-hidden rounded-2xl border bg-[#05040d]" style={{ borderColor: "rgba(139,92,246,0.1)" }}>
                                            <div className="border-b px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500" style={{ background: "rgba(139,92,246,0.04)", borderColor: "rgba(139,92,246,0.1)" }}>
                                                Executed SQL
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
                <motion.div variants={itemVariants} className="nv-card-premium rounded-[2.5rem] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                    <div className="mb-10 flex items-center gap-5">
                        <div className="nv-glow flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-500/60">Strategic Advisory</p>
                            <h3 className="text-2xl font-black text-white tracking-tight">Recommended Actions</h3>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {item.response.recommendations.map((r, i) => (
                            <div key={i} className="group flex gap-5 p-4 rounded-2xl transition-all hover:bg-emerald-500/[0.03] border border-transparent hover:border-emerald-500/10">
                                <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xs font-black text-slate-500 group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-all shadow-inner">
                                    {i + 1}
                                </div>
                                <p className="text-[15px] leading-relaxed text-slate-300 group-hover:text-white transition-colors">{r}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="nv-card-premium rounded-[2.5rem] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-3xl rounded-full" />
                    <div className="mb-10 flex items-center gap-5">
                        <div className="nv-glow flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-violet-600/10 border border-violet-500/25 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                            <Sparkles className="h-7 w-7 text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400/60">Data Exploration</p>
                            <h3 className="text-2xl font-black text-white tracking-tight">Next Questions</h3>
                        </div>
                    </div>
                    <div className="grid gap-4">
                        {item.response.follow_up_questions.map((q) => (
                            <button key={q} onClick={() => onRunPrompt(q)}
                                className="group flex items-center justify-between rounded-2xl border px-6 py-5 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/[0.03] hover:shadow-2xl border-violet-500/10 bg-violet-500/[0.01]">
                                <span className="pr-4 text-sm font-semibold leading-relaxed text-slate-300 group-hover:text-white transition-colors">{q}</span>
                                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 group-hover:border-violet-500/40 group-hover:bg-violet-500/10 transition-all">
                                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:translate-x-0.5 group-hover:text-violet-400 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.section>
    );
}

