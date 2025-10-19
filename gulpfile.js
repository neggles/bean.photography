import { src, dest, series, task, parallel, watch } from "gulp";
import sass from "gulp-dart-sass";
import { deleteSync } from "del";

function clean(cb) {
    deleteSync("dist/**", { force: true });
    cb();
}

task("assets", function () {
    return src("src/assets/*", { encoding: false }).pipe(dest("dist/assets/"));
});

task("beans", function () {
    return src("src/beans/*", { encoding: false }).pipe(dest("dist/beans/"));
});

task("javascript", function () {
    return src("src/js/*.js").pipe(dest("dist/js/"));
});

task("css", function () {
    return src("src/css/*.css").pipe(dest("dist/css/"));
});

task("sass", function () {
    return src("./src/css/*.scss").pipe(sass().on("error", sass.logError)).pipe(dest("dist/css"));
});

task("sass:watch", function () {
    watch("./src/css/*.scss", ["sass"]);
});

task("html", function (cb) {
    return series(
        function () {
            return src(["src/*.html", "src/*.xml"]).pipe(dest("dist/"));
        },
        function () {
            return src("src/favicon.ico", { encoding: false }).pipe(dest("dist/"));
        }
    )(cb);
});

function build(cb) {
    return parallel("assets", "beans", "javascript", "css", "sass", "html")(cb);
}

const _build = build;
export { _build as build };
const _default = series(clean, build);
export { _default as default };
