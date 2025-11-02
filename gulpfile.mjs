import { exec } from "child_process";
import { deleteAsync } from "del";
import { dest, lastRun, parallel, series, src, watch } from "gulp";
import concat from "gulp-concat";
import cssnano from "gulp-cssnano";
import rename from "gulp-rename";
import gulpSass from "gulp-sass";
import terser from "gulp-terser";
import log from "gulplog";
import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import * as dartSass from "sass";

// Build flags
const isProduction = process.env.NODE_ENV === "production";
let isWatching = false;

// File paths
const paths = {
    assets: {
        src: "src/assets/*",
        dest: "dist/",
    },
    favicon: {
        src: "src/favicon.*",
        dest: "dist/",
    },
    beans: {
        src: "src/beans/*",
        dest: "dist/",
        subDir: "/beans",
    },
    styles: {
        src: ["src/styles/*.css", "src/**/*.scss"],
        dest: "dist/",
    },
    scripts: {
        src: ["src/scripts/*.js", "src/scripts/*.jsm"],
        dest: "dist/",
    },
    html: {
        src: ["src/*.html", "src/*.xml"],
        dest: "dist/",
    },
};

const terserOptions = {
    ecma: 2020,
    compress: { ecma: 2020, passes: 2, drop_debugger: true },
    keep_fnames: true,
    keep_classnames: true,
    mangle: { safari10: true },
    format: { comments: false },
};

// Initialize sass compiler
const sass = gulpSass(dartSass);

// Return a no-op transform that simply passes Vinyl files through unchanged
function noopPlugin() {
    return new Transform({
        objectMode: true,
        transform(file, _enc, cb) {
            cb(null, file);
        },
    });
}

// bean list generation func
function beanListWriter({ outDir, outFile, exclude = [] }) {
    const picked = [];
    const block = new Set(Array.isArray(exclude) ? exclude : [exclude]);

    return new Transform({
        objectMode: true,
        transform(file, _, cb) {
            // pass vinyl file through unchanged so gulp can keep doing what it's doing
            if (file && file.path) {
                const name = path.basename(file.path);
                if (!block.has(name)) picked.push(name);
            }
            cb(null, file);
        },
        final(cb) {
            try {
                // deterministic builds, because chaos is for prod only
                picked.sort((a, b) =>
                    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }),
                );
                fs.mkdirSync(outDir, { recursive: true });
                const contents =
                    `// auto-generated. do not edit by hand unless you enjoy suffering\n`
                    + `export const beanDir = ${JSON.stringify(paths.beans.subDir)};\n`
                    + `export const beanFiles = ${JSON.stringify(picked, null, 4)};\n`
                    + `export const beans = beanFiles.map(f => beanDir + '/' + f);\n`
                    + `export default beans;\n`;
                fs.writeFileSync(path.join(outDir, outFile), contents, "utf8");
                log.info(`beanListWriter: wrote ${outDir + outFile} with ${picked.length} entries`);
                cb();
            } catch (err) {
                cb(err);
            }
        },
    });
}

export const clean = () => deleteAsync("dist/**", { force: true });

export function assets() {
    return src(paths.assets.src, { encoding: false }).pipe(dest(paths.assets.dest));
}

export function favicon() {
    return src(paths.favicon.src, { encoding: false }).pipe(dest(paths.assets.dest));
}

export function beans() {
    return src(paths.beans.src, { encoding: false, since: lastRun(beans), base: "src" })
        .pipe(
            beanListWriter({
                outDir: paths.scripts.dest,
                outFile: "beans.js",
                exclude: ["beanlet.png"],
            }),
        )
        .pipe(dest(paths.beans.dest));
}

export function scripts() {
    const shouldMinify = isProduction && !isWatching;
    function minifyWrapper(enabled) {
        if (!enabled) return noopPlugin();
        return terser(terserOptions);
    }

    return src(paths.scripts.src, { sourcemaps: true })
        .pipe(minifyWrapper(shouldMinify))
        .pipe(dest(paths.scripts.dest, { sourcemaps: true }));
}

export function styles() {
    const shouldMinify = isProduction && !isWatching;
    function minifyWrapper(enabled) {
        if (!enabled) return noopPlugin();
        return cssnano();
    }

    return src(paths.styles.src, { sourcemaps: true })
        .pipe(sass({ outputStyle: "nested" }).on("error", sass.logError))
        .pipe(concat("styles.css"))
        .pipe(minifyWrapper(shouldMinify))
        .pipe(dest(paths.styles.dest, { sourcemaps: "." }));
}

export function html() {
    return src(paths.html.src).pipe(dest(paths.html.dest));
}

export function serve() {
    return exec(`serve ${paths.html.dest} -l 3000`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        log.info(`stdout: ${stdout}`);
        log.error(`stderr: ${stderr}`);
    });
}

function watchFiles() {
    isWatching = true;
    clean();
    build();
    watch(paths.assets.src, assets);
    watch(paths.favicon.src, favicon);
    watch(paths.beans.src, beans);
    watch(paths.styles.src, styles);
    watch(paths.scripts.src, scripts);
    watch(paths.html.src, html);
    serve();
    log.info("Watch tasks running. Press Ctrl+C to exit.");
}
export { watchFiles as watch };

const build = series(clean, parallel(assets, favicon, beans, scripts, styles, html));
export default build;
