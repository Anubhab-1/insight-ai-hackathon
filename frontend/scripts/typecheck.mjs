import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const nextBin = join("node_modules", "next", "dist", "bin", "next");
const tscBin = join("node_modules", "typescript", "bin", "tsc");

function run(command, args) {
    const result = spawnSync(process.execPath, [command, ...args], { stdio: "inherit" });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run(nextBin, ["typegen"]);

rmSync("tsconfig.tsbuildinfo", { force: true });

const devCacheLife = join(".next", "dev", "types", "cache-life.d.ts");
const appCacheLife = join(".next", "types", "cache-life.d.ts");

if (existsSync(devCacheLife)) {
    mkdirSync(dirname(appCacheLife), { recursive: true });
    copyFileSync(devCacheLife, appCacheLife);
}

run(tscBin, ["--noEmit"]);
