import { exec } from "child_process";
import { deleteAsync } from "del";
import { dest, lastRun, parallel, series, src, watch } from "gulp";
import concat from "gulp-concat";
import gulpSass from "gulp-sass";
import terser from "gulp-terser";
import { Transform } from "node:stream";
import * as dartSass from "sass";
const sass = gulpSass(dartSass);

// Build flags
const isProduction = process.env.NODE_ENV === "production";
let isWatching = false;

// Return a no-op transform that simply passes Vinyl files through unchanged
function noopPlugin() {
    return new Transform({
        objectMode: true,
        transform(chunk, enc, cb) {
            cb(null, chunk);
        },
    });
}

// Unified minify wrapper: always pipe through a stream; when disabled, it's a no-op

const paths = {
    assets: {
        src: "src/assets/*",
        dest: "dist/",
    },
    favicon: {
        src: "src/assets/favicon.*",
        // uses assets.dest as destination
    },
    beans: {
        src: "src/beans/*",
        dest: "dist/",
    },
    styles: {
        src: ["src/**/*.css", "src/**/*.scss"],
        dest: "dist/",
    },
    scripts: {
        src: "src/**/*.js",
        dest: "dist/",
    },
    html: {
        src: ["src/*.html", "src/*.xml"],
        dest: "dist/",
    },
};

export const clean = () => deleteAsync("dist/**", { force: true });

export function assets() {
    return src([paths.assets.src, paths.favicon.src], {
        encoding: false,
        since: lastRun(assets),
    }).pipe(dest(paths.assets.dest));
}

export function beans() {
    return src(paths.beans.src, { encoding: false, since: lastRun(beans), base: "src" }).pipe(
        dest(paths.beans.dest),
    );
}

export function scripts() {
    const shouldMinify = isProduction && !isWatching;
    function minifyWrapper(enabled) {
        if (!enabled) return noopPlugin();
        return terser({
            ecma: 2020,
            compress: {
                ecma: 2020,
                passes: 2,
                drop_debugger: true,
            },
            keep_fnames: true,
            keep_classnames: true,
            mangle: { safari10: true },
            format: { comments: false },
        });
    }

    return src(paths.scripts.src, { since: lastRun(scripts), sourcemaps: true })
        .pipe(concat("index.js"))
        .pipe(minifyWrapper(shouldMinify))
        .pipe(dest(paths.scripts.dest, { sourcemaps: "." }));
}

export function styles() {
    return src(paths.styles.src, { since: lastRun(styles), sourcemaps: true })
        .pipe(sass({ outputStyle: "nested" }).on("error", sass.logError))
        .pipe(concat("styles.css"))
        .pipe(dest(paths.styles.dest, { sourcemaps: "." }));
}

export function html() {
    return src(paths.html.src).pipe(dest(paths.html.dest));
}

export function serve() {
    return exec("serve dist -l 3000");
}

function watchFiles() {
    isWatching = true;
    clean();
    build();
    watch(paths.assets.src, assets);
    watch(paths.beans.src, beans);
    watch(paths.styles.src, styles);
    watch(paths.scripts.src, scripts);
    watch(paths.html.src, html);
    serve();
}
export { watchFiles as watch };

const build = series(clean, parallel(assets, beans, scripts, styles, html));
export default build;
