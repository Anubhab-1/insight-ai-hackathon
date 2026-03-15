"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(180deg,_#0b1020_0%,_#070b16_42%,_#030507_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl place-items-center">
        <div className="w-full max-w-3xl rounded-[2rem] border border-white/8 bg-[linear-gradient(140deg,_rgba(15,23,42,0.92),_rgba(5,10,24,0.94))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="mt-6 h-12 w-3/4 animate-pulse rounded-2xl bg-white/8" />
          <div className="mt-4 h-24 animate-pulse rounded-[1.5rem] bg-white/6" />
        </div>
      </div>
    </main>
  ),
});

export default function Home() {
  return <Dashboard />;
}
