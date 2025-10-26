import { exec } from "child_process";
import { deleteAsync } from "del";
import { dest, lastRun, parallel, series, src, watch } from "gulp";
import concat from "gulp-concat";
import gulpSass from "gulp-sass";
import uglify from "gulp-uglify";
import * as dartSass from "sass";
const sass = gulpSass(dartSass);

const paths = {
    assets: {
        src: "src/assets/*",
        dest: "dist/",
    },
    beans: {
        src: "src/beans/*",
        dest: "dist/",
    },
    favicon: {
        src: "src/assets/favicon.*",
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
    return src(paths.assets.src, { encoding: false }).pipe(dest(paths.assets.dest));
}

export function favicon() {
    return src(paths.favicon.src, { encoding: false }).pipe(dest(paths.favicon.dest));
}

export function beans() {
    return src(paths.beans.src, { encoding: false, since: lastRun(beans), base: "src" }).pipe(
        dest(paths.beans.dest),
    );
}

export function scripts() {
    return src(paths.scripts.src, { since: lastRun(scripts), sourcemaps: true })
        .pipe(dest(paths.scripts.dest))
        .pipe(concat("index.js"))
        .pipe(uglify())
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
