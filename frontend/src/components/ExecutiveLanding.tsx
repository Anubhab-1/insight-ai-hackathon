"use client";

import { InsightCard } from "@/types";
import { ArrowRight, BarChart3, BrainCircuit, Database, ShieldCheck, Sparkles, Zap } from "lucide-react";

interface DatasetState {
    name: string;
    rows: number;
    columns: string[];
    schema: string;
    examplePrompts: string[];
}

interface PromptCard {
    label: string;
    prompt: string;
}

const FEATURE_PILLS = [
    { icon: ShieldCheck, label: "Grounded SQL", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
    { icon: BrainCircuit, label: "Agentic Self-Healing", color: "#06b6d4", bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.2)" },
    { icon: BarChart3, label: "Bento Dashboards", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)" },
    { icon: Zap, label: "Real-time Narration", color: "#c026d3", bg: "rgba(192,38,211,0.1)", border: "rgba(192,38,211,0.2)" },
];

export default function ExecutiveLanding({
    activeDataset, insights, loadingInsights, promptCards, onRunPrompt, onOpenUpload,
}: {
    activeDataset: DatasetState | null;
    insights: InsightCard[];
    loadingInsights: boolean;
    promptCards: PromptCard[];
    onRunPrompt: (prompt: string) => void;
    onOpenUpload: () => void;
}) {
    return (
        <div className="space-y-8 py-2 sm:space-y-10 sm:py-4">
            {/* ── Hero Section ── */}
            <section className="nv-card relative overflow-hidden rounded-[2rem] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.5)] sm:rounded-[2.5rem] sm:p-10 lg:p-14">
                {/* Internal orbs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-[80px] sm:h-80 sm:w-80"
                        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", animation: "orb-drift-a 18s ease-in-out infinite" }} />
                    <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-15 blur-[70px] sm:h-80 sm:w-80"
                        style={{ background: "radial-gradient(circle, #c026d3, transparent 70%)", animation: "orb-drift-b 22s ease-in-out infinite" }} />
                    <div className="absolute right-1/3 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full opacity-10 blur-[60px]"
                        style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)", animation: "orb-drift-c 26s ease-in-out infinite" }} />
                </div>

                <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl space-y-6">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur-md sm:px-4 sm:py-2"
                            style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.08)", color: "#c4b5fd" }}>
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                            Neural Intelligence Platform
                        </div>

                        {/* Heading */}
                        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                            Data that{" "}
                            <span className="nv-gradient-text">thinks for itself.</span>
                        </h1>

                        <p className="max-w-xl text-sm leading-relaxed sm:text-base sm:leading-8" style={{ color: "#a89bc2" }}>
                            Lumina transforms raw CSV data into executive narratives and live dashboards through autonomous agentic SQL planning — no code, no configuration.
                        </p>

                        {/* Feature pills */}
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                            {FEATURE_PILLS.map(({ icon: Icon, label, color, bg, border }) => (
                                <div
                                    key={label}
                                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                                    style={{ background: bg, borderColor: border, color }}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        {!activeDataset && (
                            <button
                                onClick={onOpenUpload}
                                className="liquid-btn nv-btn-primary group inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white sm:gap-3 sm:px-7 sm:py-4 sm:text-base"
                            >
                                <Database className="h-4 w-4 sm:h-5 sm:w-5" />
                                Upload Dataset
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />
                            </button>
                        )}
                    </div>

                    {/* Right: animated icon */}
                    <div className="relative mx-auto shrink-0 sm:mx-0">
                        <div className="absolute inset-0 rounded-[2.5rem] blur-3xl opacity-30"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }} />
                        <div className="relative flex h-44 w-44 items-center justify-center rounded-[2.5rem] border sm:h-56 sm:w-56 lg:h-64 lg:w-64"
                            style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(9,7,20,0.8)" }}>
                            {/* Neural pulse rings */}
                            <div className="absolute inset-8 rounded-full border opacity-30"
                                style={{ borderColor: "rgba(139,92,246,0.4)", animation: "neural-pulse 2.4s ease-in-out infinite" }} />
                            <div className="absolute inset-10 rounded-full border opacity-20"
                                style={{ borderColor: "rgba(6,182,212,0.5)", animation: "neural-pulse 2.4s ease-in-out infinite 0.8s" }} />
                            <Sparkles className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24" style={{ color: "#c4b5fd", animation: "float 7s ease-in-out infinite" }} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Content Grid ── */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Dataset Portal */}
                <section className="nv-card nv-card-hover rounded-[2rem] p-6 sm:p-8">
                    <div className="mb-5 flex items-center justify-between sm:mb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border sm:h-12 sm:w-12"
                                style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.1)" }}>
                                <Database className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "#c4b5fd" }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] sm:text-[11px]" style={{ color: "#7c6fa0" }}>Source Connection</p>
                                <h2 className="text-lg font-semibold text-white sm:text-2xl">Dataset Insight</h2>
                            </div>
                        </div>
                        {activeDataset && (
                            <span className="nv-pill-emerald rounded-full px-2.5 py-1 text-xs font-bold sm:px-3">Active</span>
                        )}
                    </div>

                    {activeDataset ? (
                        <div className="space-y-4 sm:space-y-5">
                            <div className="rounded-2xl border p-4 sm:p-5"
                                style={{ borderColor: "rgba(139,92,246,0.12)", background: "rgba(139,92,246,0.04)" }}>
                                <p className="text-xl font-bold capitalize text-white sm:text-2xl">{activeDataset.name.replace(/_/g, " ")}</p>
                                <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#7c6fa0" }}>Rows</p>
                                        <p className="mt-1 text-base font-semibold text-white sm:text-lg">{activeDataset.rows.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#7c6fa0" }}>Columns</p>
                                        <p className="mt-1 text-base font-semibold text-white sm:text-lg">{activeDataset.columns.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <p className="px-1 text-[10px] font-bold uppercase tracking-widest sm:text-xs" style={{ color: "#7c6fa0" }}>Quick Exploration</p>
                                {promptCards.slice(0, 2).map((item) => (
                                    <button key={item.label} onClick={() => onRunPrompt(item.prompt)}
                                        className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all hover:border-violet-500/30 sm:px-5 sm:py-4"
                                        style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.03)" }}>
                                        <span className="pr-3 text-xs leading-relaxed text-white/80 sm:text-sm">{item.prompt}</span>
                                        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "#7c6fa0" }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center sm:h-48"
                            style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.02)" }}>
                            <p className="text-sm" style={{ color: "#7c6fa0" }}>No dataset connected yet.</p>
                            <button onClick={onOpenUpload}
                                className="mt-3 flex items-center gap-2 text-xs font-semibold transition-colors hover:text-violet-300 sm:text-sm"
                                style={{ color: "#c4b5fd" }}>
                                <Database className="h-4 w-4" />
                                Upload a CSV to unlock Lumina
                            </button>
                        </div>
                    )}
                </section>

                {/* Proactive Insights */}
                <section className="nv-card nv-card-hover rounded-[2rem] p-6 sm:p-8">
                    <div className="mb-5 sm:mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] sm:text-[11px]" style={{ color: "#7c6fa0" }}>Intelligence Engine</p>
                        <h2 className="mt-1 text-lg font-semibold text-white sm:text-2xl">Proactive Discoveries</h2>
                    </div>

                    {loadingInsights ? (
                        <div className="space-y-3 sm:space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-24 animate-pulse rounded-2xl border sm:h-28"
                                    style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.03)" }} />
                            ))}
                        </div>
                    ) : insights.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            {insights.slice(0, 2).map((card, index) => (
                                <div key={`${card.title}-${index}`} className="nv-card nv-card-hover rounded-2xl p-4 sm:p-5">
                                    <div className="mb-2 flex items-center gap-2 sm:gap-3">
                                        <div className="rounded-xl border p-1.5 sm:p-2" style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.1)" }}>
                                            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: "#c4b5fd" }} />
                                        </div>
                                        <p className="text-sm font-semibold text-white sm:text-base">{card.title}</p>
                                    </div>
                                    <p className="line-clamp-2 text-xs leading-relaxed sm:text-sm" style={{ color: "#7c6fa0" }}>{card.description}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center sm:h-48"
                            style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.02)" }}>
                            <p className="text-sm" style={{ color: "#7c6fa0" }}>Awaiting your data...</p>
                            <p className="mt-1 text-xs" style={{ color: "rgba(124,111,160,0.6)" }}>Insights generate automatically once a dataset is live.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
