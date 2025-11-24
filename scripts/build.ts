#!/usr/bin/env bun
import { readFileSync } from "fs";
import { join } from "path";

// Read package.json to get all dependencies
const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf-8"),
);

// Get all dependency names (both dependencies and devDependencies)
const dependencies = Object.keys(packageJson.dependencies || {});

console.log("📦 Building with external packages:");
console.log(
    `   Externalizing ${dependencies.length} packages from node_modules`,
);
console.log("   Bundling source code with resolved path aliases\n");

// Build with Bun
const result = await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "bun",
    external: dependencies,
    minify: false,
    sourcemap: "none",
});

if (!result.success) {
    console.error("❌ Build failed:");
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

console.log("✨ Build complete!");
console.log(`   Output: dist/index.js`);
