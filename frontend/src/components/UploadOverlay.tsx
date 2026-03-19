"use client";

import { useState, useRef } from "react";
import { UploadCloud, File, AlertCircle, Sparkles, Loader2, Zap } from "lucide-react";
import { UploadResponse } from "@/types";
import { buildApiUrl } from "@/lib/api";

interface ApiErrorPayload {
    detail?: string;
}

export default function UploadOverlay({ onUploadSuccess }: { onUploadSuccess: (data: UploadResponse) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            const f = e.dataTransfer.files[0];
            if (f.name.toLowerCase().endsWith(".csv")) { setError(""); setFile(f); }
            else setError("Only .csv files are allowed.");
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true); setError("");
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch(buildApiUrl("/api/upload"), { method: "POST", body: formData });
            const text = await res.text();
            let data: UploadResponse | null = null;
            try { data = JSON.parse(text) as UploadResponse; } catch {}
            const errorPayload = data as ApiErrorPayload | null;
            if (!res.ok) throw new Error(errorPayload?.detail || "Upload failed");
            if (!data) throw new Error("Upload returned invalid JSON.");
            onUploadSuccess(data);
        } catch (err) {
            setError((err as Error).message);
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.18) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(192,38,211,0.12) 0%, transparent 55%), #04030a" }}>
            {/* Animated mesh bg */}
            <div className="pointer-events-none fixed inset-0 z-0" style={{
                backgroundImage: "linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)",
                backgroundSize: "48px 48px"
            }} />

            {/* Drifting orbs */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]"
                    style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", animation: "orb-drift-a 18s ease-in-out infinite" }} />
                <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full opacity-15 blur-[100px]"
                    style={{ background: "radial-gradient(circle, #c026d3, transparent 70%)", animation: "orb-drift-b 22s ease-in-out infinite" }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full opacity-10 blur-[80px]"
                    style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)", animation: "orb-drift-c 26s ease-in-out infinite" }} />
            </div>

            <div className="relative z-10 w-full max-w-md animate-[fade-in-up_0.5s_cubic-bezier(0.16,1,0.3,1)]">
                {/* Card */}
                <div className="nv-card overflow-hidden rounded-[2rem] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.7),0_0_0_1px_rgba(139,92,246,0.2)] sm:p-8">
                    {/* Top accent line */}
                    <div className="absolute left-0 right-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(6,182,212,0.4), transparent)" }} />

                    {/* Header */}
                    <div className="mb-6 text-center sm:mb-8">
                        {/* Particle ring icon */}
                        <div className="relative mx-auto mb-5 h-20 w-20 sm:h-24 sm:w-24">
                            {/* Rotating ring */}
                            <div className="absolute inset-0 rounded-full" style={{
                                background: "conic-gradient(from 0deg, transparent 0deg, rgba(139,92,246,0.8) 60deg, rgba(6,182,212,0.6) 120deg, transparent 180deg, transparent 360deg)",
                                animation: "particle-ring 2.4s linear infinite",
                                padding: "2px",
                                borderRadius: "50%",
                            }}>
                                <div className="h-full w-full rounded-full" style={{ background: "#090714" }} />
                            </div>
                            {/* Second slower ring */}
                            <div className="absolute inset-2 rounded-full" style={{
                                background: "conic-gradient(from 180deg, transparent 0deg, rgba(192,38,211,0.5) 80deg, transparent 160deg, transparent 360deg)",
                                animation: "particle-ring 4s linear infinite reverse",
                                padding: "1px",
                                borderRadius: "50%",
                            }}>
                                <div className="h-full w-full rounded-full" style={{ background: "#090714" }} />
                            </div>
                            {/* Icon center */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: "#c4b5fd" }} />
                            </div>
                        </div>

                        <h2 className="nv-gradient-text text-2xl font-bold tracking-tight sm:text-3xl">
                            Upload a Dataset
                        </h2>
                        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed sm:text-sm" style={{ color: "#7c6fa0" }}>
                            Drop in a CSV to load it into Lumina and start generating dashboards.
                        </p>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative cursor-pointer rounded-[1.5rem] border-2 border-dashed p-6 text-center transition-all duration-300 sm:p-8 ${
                            isDragging
                                ? "shadow-[0_0_40px_rgba(139,92,246,0.25),inset_0_0_20px_rgba(139,92,246,0.05)]"
                                : "hover:border-violet-500/40"
                        }`}
                        style={{
                            borderColor: isDragging ? "rgba(139,92,246,0.6)" : "rgba(139,92,246,0.2)",
                            background: isDragging ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.02)",
                        }}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) { setError(""); setFile(e.target.files[0]); } }}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)" }}>
                                    <File className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: "#c4b5fd" }} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white sm:text-base">{file.name}</p>
                                    <p className="mt-1 text-xs sm:text-sm" style={{ color: "#7c6fa0" }}>
                                        {(file.size / 1024).toFixed(1)} KB - Ready to analyze
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.05)" }}>
                                    <UploadCloud className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: "#7c6fa0" }} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white sm:text-base">Drag &amp; drop your CSV</p>
                                    <p className="mt-1 text-xs sm:text-sm" style={{ color: "#7c6fa0" }}>or click to browse files</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 flex items-start gap-2 rounded-[1rem] border px-3 py-2.5 text-xs sm:mt-5 sm:gap-3 sm:rounded-[1.25rem] sm:px-4 sm:py-3 sm:text-sm"
                            style={{ borderColor: "rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.08)", color: "#fda4af" }}>
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#fb7185" }} />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="liquid-btn nv-btn-primary relative mt-5 flex w-full items-center justify-center gap-2 rounded-[1.25rem] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-40 disabled:shadow-none disabled:hover:transform-none sm:mt-6 sm:gap-3 sm:py-4 sm:text-base"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                                Preparing dataset...
                            </>
                        ) : (
                            <>
                                <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                                Analyze Dataset
                            </>
                        )}
                    </button>
                </div>

                {/* Bottom tagline */}
                <p className="mt-4 text-center text-xs" style={{ color: "rgba(124,111,160,0.6)" }}>
                    Your file stays in this local workspace
                </p>
            </div>
        </div>
    );
}
