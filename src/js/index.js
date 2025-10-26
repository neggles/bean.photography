import beans from "./beans.js";
const special_bean = `/beans/beanlet.png`;

// get URL parameters
const params = new URLSearchParams(window.location.search);
// get local storage
const storage = window.localStorage;

// track last bean so we don't repeat it
let lastBean = storage.getItem("lastBean");
// we'll store the bean bounding box here once it's computed
var beanBbox = null;

// track page load count
let loadCount = parseInt(storage.getItem("loadCount") || "0", 10);
loadCount += 1;
storage.setItem("loadCount", loadCount.toString());

// generate a random integer between min and max, inclusive. assumes integer inputs
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// pick a bean image source URL based on some conditions. is only expected to be called once per page load.
function pickBeanSrc() {
    if (randInt(0, 69) === 69 || loadCount === 42) {
        console.info("You found the special bean! 🎉");
        storage.setItem("loadCount", "0"); // reset load count
        storage.setItem("lastBean", special_bean); // set last bean to special bean
        return special_bean;
    } else {
        let bean;
        do {
            bean = beans[randInt(0, beans.length - 1)];
        } while (bean === lastBean);
        lastBean = bean;
        storage.setItem("lastBean", lastBean);
        return bean;
    }
}

/**
 * Load a random bean image and invoke a callback when it finishes loading.
 *
 * @param {(img: HTMLImageElement) => void} cb - Callback invoked with the loaded HTML image element.
 * @returns {HTMLImageElement} The created image element whose src is set.
 */
function getBeanImage(cb) {
    const img = document.createElement("img");
    img.addEventListener("load", () => cb(img), { once: true });
    img.addEventListener("error", (e) => {
        console.error("Failed to load bean image:", img.src, e);
    });
    img.src = pickBeanSrc();
    return img;
}

// get bounding box of non-transparent pixels in a canvas context
function getBoundingBox(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    function checkRow(data, width, y) {
        for (let x = 0, index = 4 * y * width; x < width; ++x, index += 4) {
            if (data[index + 3] !== 0) return false;
        }
        return true;
    }

    function checkColumn(data, width, x, top, bottom) {
        const stride = 4 * width;
        for (let y = top, index = top * stride + 4 * x; y <= bottom; ++y, index += stride) {
            if (data[index + 3] !== 0) return false;
        }
        return true;
    }

    let left = 0;
    let top = 0;
    let right = width - 1;
    let bottom = height - 1;

    while (top < height && checkRow(data, width, top)) ++top;
    if (top === height) return null;
    while (checkRow(data, width, bottom)) --bottom;
    while (checkColumn(data, width, left, top, bottom)) ++left;
    while (checkColumn(data, width, right, top, bottom)) --right;

    ++right;
    ++bottom;

    return { left: left, top: top, right: right, bottom: bottom };
}

// get bounding box of non-transparent pixels in an image
function getImageBbox(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Canvas context not found");
        return null;
    }
    ctx.drawImage(image, 0, 0);
    return getBoundingBox(ctx, canvas.width, canvas.height);
}

// load the bean image and compute its bounding box once loaded
/** @type {HTMLImageElement} **/
const bean = getBeanImage((img) => {
    beanBbox = getImageBbox(img);
    if (beanBbox) {
        console.debug("Bean bounding box:", beanBbox);
    } else {
        console.warn("Could not determine bean bounding box");
    }
});

// parse speed parameter from URL, defaulting to 1.0 if invalid
function parseSpeed(searchParams) {
    const raw = searchParams.get("speed");
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? n : 1.0; // default 1.0 px/frame
}

class PageEffects {
    constructor(parent) {
        /** @type {HTMLElement} **/
        this.parent = typeof parent === "string" ? document.querySelector(parent) : parent;
        if (!this.parent) throw new Error("Parent not found");

        // ensure initial position is within the window bounds
        this.xpos = randInt(1, window.innerWidth - 512 - 1);
        this.ypos = randInt(1, window.innerHeight - 512 - 1);

        this.dvd = {};
        this.dvdframe = undefined;
        this.speed = parseSpeed(params);
        this.dir = { x: randInt(0, 1) === 0 ? -1 : 1, y: randInt(0, 1) === 0 ? -1 : 1 };

        window.addEventListener("resize", this.onResize.bind(this), false);

        this.onResize();
        this.initDVD();
    }

    onResize() {
        this.rect = { width: window.innerWidth, height: window.innerHeight };
        this.initDVD(); // reinitialize DVD effect on resize
    }

    // DVD Screensaver Effect
    initDVD() {
        if (this.dvdframe !== undefined) {
            window.cancelAnimationFrame(this.dvdframe);
            this.dvdframe = undefined;
        }

        /** @type {HTMLCanvasElement} **/
        const canvas = document.getElementById("dvd");
        if (!canvas) {
            console.error("DVD canvas not found");
            return;
        }
        /** @type {CanvasRenderingContext2D} **/
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            console.error("DVD canvas context not found");
            return;
        }

        canvas.width = this.rect.width;
        canvas.height = this.rect.height;
        this.dvd = { canvas: canvas, ctx: ctx };

        const animate = () => {
            this.renderDVD();
            this.dvdframe = window.requestAnimationFrame(animate);
        };
        animate();
    }

    renderDVD() {
        // early out if bean image is not available (shouldn't happen) or bbox is not ready yet
        if (!bean || !beanBbox) return;

        /** @type {HTMLCanvasElement} **/
        const canvas = this.dvd.canvas;
        /** @type {CanvasRenderingContext2D} **/
        const ctx = this.dvd.ctx;
        if (!ctx) return;

        // clear canvas and draw bean at current position
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bean, this.xpos, this.ypos);

        const margin = 32;

        const leftEdge = this.xpos + beanBbox.left + margin;
        const rightEdge = this.xpos + beanBbox.right - margin;
        const topEdge = this.ypos + beanBbox.top + margin;
        const bottomEdge = this.ypos + beanBbox.bottom - margin;

        // check if logo is bouncing on the left/right side
        if (leftEdge <= 1) this.dir.x = 1;
        else if (rightEdge + 1 >= canvas.width) this.dir.x = -1;

        // check if logo is bouncing on the top/bottom side
        if (topEdge <= 1) this.dir.y = 1;
        else if (bottomEdge + 1 >= canvas.height) this.dir.y = -1;

        // update position for next frame
        this.xpos += this.speed * this.dir.x;
        this.ypos += this.speed * this.dir.y;
    }
}

// how to tell jshint this is used?
const pageEffects = new PageEffects("div.screen");

export { pageEffects };
