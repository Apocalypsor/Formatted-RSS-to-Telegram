const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");

esbuild
    .build({
        entryPoints: ["src/index.ts"],
        bundle: true,
        platform: "node",
        target: "node18",
        outfile: "dist/index.js",
        plugins: [nodeExternalsPlugin()],
        tsconfig: "tsconfig.json",
        sourcemap: true,
    })
    .catch(() => process.exit(1));
