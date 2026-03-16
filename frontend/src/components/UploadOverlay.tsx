"use client";

import { useState, useRef } from "react";
import { UploadCloud, File, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { UploadResponse } from "@/types";
import { buildApiUrl } from "@/lib/api";

export default function UploadOverlay({ onUploadSuccess }: { onUploadSuccess: (data: UploadResponse) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.toLowerCase().endsWith(".csv")) {
                setError("");
                setFile(droppedFile);
            } else {
                setError("Only .csv files are allowed.");
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError("");
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(buildApiUrl("/api/upload"), {
                method: "POST",
                body: formData,
            });
            const text = await res.text();
            let data: UploadResponse | null = null;
            try {
                data = JSON.parse(text) as UploadResponse;
            } catch (parseError) {
                console.error("Upload JSON parse failed:", parseError);
                console.log("Raw response was:", text);
            }

            if (!res.ok) {
                const detail = (data as any)?.detail || (text ? text : "Upload failed");
                throw new Error(detail);
            }

            if (!data) {
                throw new Error("Upload returned invalid JSON. Check the backend logs.");
            }

            onUploadSuccess(data);
        } catch (err) {
            const error = err as Error;
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
            {/* Ambient light effects */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/8 blur-[120px]" />
                <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/6 blur-[120px]" />
            </div>

            <div className="relative w-full max-w-lg animate-fade-in-up">
                {/* Main card */}
                <div className="glass-card overflow-hidden rounded-[2.5rem] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6)] sm:p-10">
                    {/* Subtle top accent line */}
                    <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

                    {/* Header */}
                    <div className="relative z-10 mb-8 text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-blue-400/15 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.15)] animate-float">
                            <Sparkles className="h-7 w-7 text-blue-300" />
                        </div>
                        <h2 className="gradient-text text-3xl font-bold tracking-tight text-white">
                            Lumina Core
                        </h2>
                        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                            Drop a dataset to generate grounded insights and conversational dashboards.
                        </p>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative z-10 cursor-pointer rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-10 ${
                            isDragging
                                ? "border-blue-400/60 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.15)]"
                                : "border-white/10 hover:border-blue-400/30 hover:bg-white/[0.03]"
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setError("");
                                    setFile(e.target.files[0]);
                                }
                            }}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="rounded-[1.25rem] border border-blue-400/20 bg-blue-500/10 p-4">
                                    <File className="h-8 w-8 text-blue-300" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-lg font-semibold text-white">{file.name}</span>
                                    <span className="mt-1 text-sm text-slate-400">
                                        {(file.size / 1024).toFixed(1)} KB — Ready to analyze
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4 text-slate-400 transition-all group-hover:border-blue-400/20 group-hover:bg-blue-500/10 group-hover:text-blue-300">
                                    <UploadCloud className="h-8 w-8" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-base font-semibold text-slate-200">
                                        Drag & drop your CSV here
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        or click to browse local files
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error state */}
                    {error && (
                        <div className="relative z-10 mt-5 flex items-start gap-3 rounded-[1.25rem] border border-rose-400/15 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                            <p className="leading-snug">{error}</p>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="relative z-10 mt-6 flex w-full items-center justify-center gap-3 rounded-[1.25rem] bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(59,130,246,0.25)] transition-all hover:shadow-[0_16px_48px_rgba(59,130,246,0.35)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Synchronizing Intelligence...
                            </>
                        ) : (
                            "Initialize Core Analysis"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
