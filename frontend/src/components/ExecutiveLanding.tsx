"use client";

import { InsightCard } from "@/types";
import { ArrowRight, BarChart3, BrainCircuit, Database, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

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

export default function ExecutiveLanding({
    activeDataset,
    insights,
    loadingInsights,
    promptCards,
    onRunPrompt,
    onOpenUpload,
}: {
    activeDataset: DatasetState | null;
    insights: InsightCard[];
    loadingInsights: boolean;
    promptCards: PromptCard[];
    onRunPrompt: (prompt: string) => void;
    onOpenUpload: () => void;
}) {
    return (
        <div className="space-y-12 py-4">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(145deg,_rgba(15,23,42,0.6),_rgba(2,6,23,0.8))] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] sm:p-12 lg:p-16">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
                    <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-[100px]" />
                </div>

                <div className="relative z-10 flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-3xl space-y-8">
                        <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-md shadow-2xl">
                            <div className="h-7 w-7 overflow-hidden rounded-lg">
                                <img src="/images/lumina_logo.png" alt="Lumina Logo" className="w-full h-full object-contain" />
                            </div>
                            The New Standard in Decision Intelligence
                        </div>
                        
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-7xl">
                            Intelligence that <span className="bg-gradient-to-r from-amber-200 via-blue-200 to-white bg-clip-text text-transparent">Feels Like Magic.</span>
                        </h1>
                        
                        <p className="max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl sm:leading-9">
                            Lumina transforms raw data into high-fidelity executive narratives. Connect your dataset once, and let our agents plan, query, and narrate your business performance in real-time.
                        </p>

                        {!activeDataset && (
                            <button
                                onClick={onOpenUpload}
                                className="group inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-base font-bold text-slate-950 shadow-[0_20px_50px_rgba(255,255,255,0.2)] transition hover:scale-[1.02] hover:bg-slate-100"
                            >
                                Connect Dataset
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        )}

                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-white/5 px-5 py-3 text-sm text-slate-300">
                                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                                Grounded in Safe SQL
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-white/5 px-5 py-3 text-sm text-slate-300">
                                <BrainCircuit className="h-5 w-5 text-blue-400" />
                                Agentic Self-Healing
                            </div>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <div className="absolute inset-0 animate-pulse bg-blue-500/20 blur-3xl" />
                        <div className="relative flex h-64 w-64 items-center justify-center rounded-[3rem] border border-white/15 bg-slate-900/50 backdrop-blur-3xl sm:h-80 sm:w-80">
                            <WandSparkles className="h-32 w-32 animate-float text-amber-200/80 sm:h-40 sm:w-40" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Content Grid */}
            <div className="grid gap-8 lg:grid-cols-2">
                {/* Dataset Portal */}
                <section className="group rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 transition-all duration-500 hover:border-amber-300/20 hover:bg-white/[0.05] sm:p-10">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950 p-3 text-amber-200 group-hover:bg-amber-300 group-hover:text-slate-950 transition-colors">
                                <Database className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Source Connection</p>
                                <h2 className="text-2xl font-semibold text-white">Dataset Insight</h2>
                            </div>
                        </div>
                        {activeDataset && (
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">Active</span>
                        )}
                    </div>

                    {activeDataset ? (
                        <div className="space-y-6">
                            <div className="rounded-[2rem] border border-white/8 bg-slate-950/50 p-6">
                                <p className="text-3xl font-bold capitalize text-white">{activeDataset.name.replace(/_/g, " ")}</p>
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Volume</p>
                                        <p className="text-lg font-semibold text-white">{activeDataset.rows.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Dimensions</p>
                                        <p className="text-lg font-semibold text-white">{activeDataset.columns.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Quick Exploration</p>
                                {promptCards.slice(0, 2).map((item) => (
                                    <button
                                        key={item.label}
                                        onClick={() => onRunPrompt(item.prompt)}
                                        className="flex w-full items-center justify-between rounded-2xl border border-white/6 bg-white/4 p-4 text-left transition hover:border-white/15 hover:bg-white/8"
                                    >
                                        <span className="text-sm font-medium text-slate-300">{item.prompt}</span>
                                        <ArrowRight className="h-4 w-4 text-slate-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-48 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 px-6 text-center">
                            <p className="text-slate-400">No dataset connected.</p>
                            <button 
                                onClick={onOpenUpload}
                                className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100 transition-colors"
                            >
                                <Database className="h-4 w-4" />
                                Connect a CSV to unlock Lumina
                            </button>
                        </div>
                    )}
                </section>

                {/* Proactive Insights Center */}
                <section className="rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
                    <div className="mb-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Intelligence Engine</p>
                        <h2 className="text-2xl font-semibold text-white">Proactive Discoveries</h2>
                    </div>

                    {loadingInsights ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-28 animate-pulse rounded-[1.5rem] border border-white/8 bg-white/4" />
                            ))}
                        </div>
                    ) : insights.length > 0 ? (
                        <div className="space-y-4">
                            {insights.slice(0, 2).map((card, index) => (
                                <div
                                    key={`${card.title}-${index}`}
                                    className="rounded-[1.5rem] border border-white/8 bg-slate-950/50 p-5 shadow-lg"
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-blue-400">
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <p className="font-semibold text-white">{card.title}</p>
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-400 line-clamp-2">{card.description}</p>
                                </div>
                            ))}
                            <p className="text-center text-xs text-slate-500">
                                Discover more by chatting with Lumina in the sidebar.
                            </p>
                        </div>
                    ) : (
                        <div className="flex h-48 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 px-6 text-center">
                            <p className="text-slate-400">Awaiting your data...</p>
                            <p className="mt-2 text-sm text-slate-500">Lumina generates insights automatically once data is live.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
