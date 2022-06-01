/* eslint-env node */
import path from "path";

export default ({ command, mode }) => {
    const isProd = mode === "production";

    return {
        build: {
            lib: {
                entry: path.resolve(__dirname, "src/index.ts"),
                formats: ["es", "cjs"],
            },
            outDir: "dist",
            sourcemap: isProd,
            minify: isProd,
        },
    };
};
