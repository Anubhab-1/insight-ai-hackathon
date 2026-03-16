"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardRenderer from "./DashboardRenderer";
import { ChartConfig, QueryResponse } from "@/types";
import { downloadWidgetCsv, exportDashboardPdf } from "@/lib/export";
import { ArrowRight, BrainCircuit, CheckCircle2, Download, FileDown, Loader2, ShieldAlert, Sparkles } from "lucide-react";

function confidenceClasses(confidence?: string) {
    if (confidence === "high") {
        return "bg-emerald-500/12 text-emerald-300 border-emerald-400/25";
    }

    if (confidence === "medium") {
        return "bg-amber-500/12 text-amber-300 border-amber-400/25";
    }

    return "bg-rose-500/12 text-rose-300 border-rose-400/25";
}

function widgetConfig(widget: QueryResponse["widgets"][number]): ChartConfig {
    return {
        type: widget.chart_type,
        xAxis: widget.x_axis,
        yAxis: widget.y_axis,
    };
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const LOADING_STEPS = [
    "Understanding the business request",
    "Planning KPIs and visual breakdowns",
    "Generating safe SQL for each widget",
    "Drafting the executive summary",
];

export default function ExecutiveDashboardView({
    item,
    openSqlWidgetId,
    onToggleSql,
    onRunPrompt,
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
            setExportMessage(null);
            setExportingWidgetId(widget.id);
            await downloadWidgetCsv(widget);
            setExportMessage({ tone: "success", text: `${widget.title} exported as CSV.` });
        } catch (error) {
            const err = error as Error;
            setExportMessage({ tone: "error", text: err.message });
        } finally {
            setExportingWidgetId(null);
        }
    }

    function handlePdfExport() {
        setExportMessage({ tone: "success", text: "Print dialog opened for PDF export." });
        exportDashboardPdf(item.response?.dashboard_title || item.query);
    }

    if (item.error) {
        return (
            <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[1.75rem] border border-rose-400/20 bg-rose-500/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:rounded-[2rem] sm:p-8"
            >
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-rose-200">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-200/70">Lumina Intelligence Error</p>
                        <h2 className="text-xl font-semibold text-white sm:text-2xl">{item.query}</h2>
                        <p className="max-w-3xl text-sm leading-7 text-rose-100/90 sm:text-base sm:leading-8">{item.error}</p>
                    </div>
                </div>
            </motion.section>
        );
    }

    if (!item.response) {
        return (
            <section className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,_rgba(11,17,31,0.82),_rgba(5,9,18,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:rounded-[2rem] sm:p-8">
                <div className="mb-5 flex items-center gap-3 sm:mb-6">
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Dashboard in progress</p>
                        <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{item.query}</h2>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {LOADING_STEPS.map((step, index) => (
                        <motion.div 
                            key={step} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="rounded-[1.6rem] border border-white/8 bg-white/4 p-5"
                        >
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-300/10 text-sm font-semibold text-amber-200">
                                    {index + 1}
                                </span>
                                <p className="text-sm font-medium text-white">{step}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>
        );
    }

    if (item.response.cannot_answer) {
        return (
            <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <div className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(140deg,_rgba(15,23,42,0.92),_rgba(5,10,24,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:rounded-[2rem] sm:p-8">
                    <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{item.query}</h2>
                    <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">{item.response.dashboard_subtitle || "The request could not be answered from the current dataset."}</p>
                </div>

                <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:rounded-[2rem] sm:p-8">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div className="space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">Graceful refusal</p>
                            <p className="max-w-3xl text-sm leading-7 text-amber-50/90 sm:text-base sm:leading-8">
                                {item.response.cannot_answer_reason}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.section>
        );
    }

    return (
        <motion.section 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="dashboard-report space-y-8 pb-12"
        >
            {/* Header Summary Card */}
            <motion.div 
                variants={itemVariants}
                className="print-card rounded-[1.75rem] border border-white/6 glass-card p-5 shadow-[0_32px_100px_rgba(0,0,0,0.4)] sm:rounded-[2.5rem] sm:p-8 lg:p-10"
            >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-4xl space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-300">
                            <BrainCircuit className="h-4 w-4 text-amber-200" />
                            Executive Dashboard
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                                {item.response.dashboard_title}
                            </h2>
                            {item.response.dashboard_subtitle && (
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                                    {item.response.dashboard_subtitle}
                                </p>
                            )}
                        </div>
                        <p className="max-w-4xl text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">
                            {item.response.executive_summary}
                        </p>
                    </div>

                    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-start lg:items-end">
                        <div className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium sm:justify-start ${confidenceClasses(item.response.confidence)}`}>
                            {item.response.confidence || "low"} confidence
                        </div>

                        <div className="dashboard-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                                onClick={handlePdfExport}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/16 sm:w-auto"
                            >
                                <FileDown className="h-4 w-4" />
                                Export PDF
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {exportMessage && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className={`dashboard-actions rounded-[1.25rem] px-4 py-3 text-sm sm:rounded-[1.5rem] sm:px-5 sm:py-4 ${
                        exportMessage.tone === "error"
                            ? "border border-rose-400/20 bg-rose-500/10 text-rose-100"
                            : "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    }`}
                >
                    {exportMessage.text}
                </motion.div>
            )}

            {/* KPI Grid - 4 Columns */}
            {item.response.kpis.length > 0 && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {item.response.kpis.map((metric, index) => (
                        <motion.div
                            key={metric.title}
                            variants={itemVariants}
                            custom={index}
                            className="print-card group bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-lg transition-all hover:bg-slate-900/60 hover:border-slate-700"
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{metric.title}</p>
                            <p className="mt-2 text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent sm:text-3xl">
                                {metric.value}
                            </p>
                            {metric.insight && (
                                <p className="mt-3 text-[13px] leading-relaxed text-slate-400 line-clamp-2">
                                    {metric.insight}
                                </p>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bento Box Chart Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {item.response.widgets.map((widget, index) => {
                    const isFullWidth = widget.chart_type === "line" || widget.chart_type === "area" || widget.chart_type === "multi_line" || widget.chart_type === "treemap" || widget.chart_type === "table";
                    return (
                        <motion.article
                            key={widget.id}
                            variants={itemVariants}
                            custom={index + 4} // Offset delay after KPIs
                            className={`print-card flex flex-col bg-[#0b0f19] border border-slate-800/80 shadow-2xl rounded-2xl overflow-hidden ${
                                isFullWidth ? "xl:col-span-2" : "xl:col-span-1"
                            }`}
                        >
                            <div className="border-b border-white/5 px-6 py-5 bg-white/[0.02]">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                            {widget.chart_type} view
                                        </div>
                                        <h3 className="text-xl font-semibold text-white">{widget.title}</h3>
                                    </div>

                                    <div className="widget-actions flex items-center gap-2">
                                        <button
                                            onClick={() => void handleWidgetExport(widget)}
                                            disabled={exportingWidgetId === widget.id}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                        >
                                            {exportingWidgetId === widget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            CSV
                                        </button>
                                        <button
                                            onClick={() => onToggleSql(widget.id)}
                                            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                                        >
                                            {openSqlWidgetId === widget.id ? "Hide SQL" : "Source"}
                                        </button>
                                    </div>
                                </div>
                                {widget.insight && (
                                    <p className="mt-3 text-sm leading-relaxed text-slate-400 italic font-light">
                                        {widget.insight}
                                    </p>
                                )}
                            </div>

                            <div className="flex-1 p-6 flex flex-col gap-6">
                                <div className="h-[320px] w-full">
                                    <DashboardRenderer data={widget.data} config={widgetConfig(widget)} />
                                </div>

                                <AnimatePresence>
                                    {openSqlWidgetId === widget.id && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden rounded-xl bg-slate-950/80 border border-slate-800"
                                        >
                                            <div className="border-b border-slate-800 px-4 py-2 text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/50">
                                                Executed Query
                                            </div>
                                            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-slate-400">
                                                {widget.sql}
                                            </pre>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.article>
                    );
                })}
            </div>

            {/* Bottom Insights & Questions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div 
                    variants={itemVariants}
                    className="print-card rounded-3xl border border-white/6 bg-white/[0.02] p-8 shadow-xl"
                >
                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Advisory</p>
                            <h3 className="text-xl font-semibold text-white">Recommended Actions</h3>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {item.response.recommendations.map((recommendation, index) => (
                            <div
                                key={`${recommendation}-${index}`}
                                className="flex gap-4 items-start group"
                            >
                                <div className="mt-1 h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                                    {index + 1}
                                </div>
                                <p className="text-[14px] leading-relaxed text-slate-300 group-hover:text-white transition-colors duration-300">{recommendation}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div 
                    variants={itemVariants}
                    className="print-card rounded-3xl border border-white/6 bg-white/[0.02] p-8 shadow-xl"
                >
                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Exploration</p>
                            <h3 className="text-xl font-semibold text-white">Follow-up Questions</h3>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {item.response.follow_up_questions.map((prompt) => (
                            <button
                                key={prompt}
                                onClick={() => onRunPrompt(prompt)}
                                className="flex w-full items-center justify-between group gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-left transition hover:border-amber-300/30 hover:bg-white/[0.05]"
                            >
                                <span className="text-sm leading-relaxed text-slate-300 group-hover:text-white transition-colors duration-300">{prompt}</span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-amber-400 transition-all duration-300 group-hover:translate-x-1" />
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.section>
    );
}
