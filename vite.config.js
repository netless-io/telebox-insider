/* eslint-disable import/no-anonymous-default-export */
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
            rollupOptions: {
                external: ["react"],
            },
            minify: isProd,
        },
    };
};
