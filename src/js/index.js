import beans from "./beans.js";
const special_bean = `/beans/beanlet.png`;

// get URL parameters
const params = new URLSearchParams(window.location.search);
// get local storage
const storage = window.localStorage;

// track last bean so we don't repeat it
let lastBean = storage.getItem("lastBean");
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
    img.id = "bean-image";
    img.style.display = "none";
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

// we'll store the bean bounding box here once it's computed
var beanBbox = null;
// load the bean image and compute its bounding box once loaded
/** @type {HTMLImageElement} **/
const bean = getBeanImage((img) => {
    beanBbox = getImageBbox(img);
    if (beanBbox) console.debug("Bean bounding box:", beanBbox);
    else console.warn("Could not determine bean bounds");
    // notify page effects that the bean is ready
    beansaver.onResize();
});

// parse speed parameter from URL, defaulting to 1.0 if invalid
function parseSpeed(searchParams) {
    const raw = searchParams.get("speed");
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? n : 1.0; // default 1.0 px/frame
}

class DVDScreensaver {
    constructor(parent, canvasId) {
        /** @type {HTMLElement} **/
        this.parent = typeof parent === "string" ? document.querySelector(parent) : parent;
        if (!this.parent) throw new Error("Parent not found");
        this.canvasId = canvasId || "dvd";
        // attach bean image to parent element
        this.parent.appendChild(bean);

        // ensure initial position is within the window bounds
        this.xpos = randInt(1, window.innerWidth - 512 - 1);
        this.ypos = randInt(1, window.innerHeight - 512 - 1);

        this.dvd = {};
        this.dvdframe = undefined;
        this.speed = parseSpeed(params);
        this.dir = { x: randInt(0, 1) === 0 ? -1 : 1, y: randInt(0, 1) === 0 ? -1 : 1 };

        window.addEventListener("resize", this.onResize.bind(this));
        window.addEventListener("orientationchange", this.onResize.bind(this));
        window.addEventListener("load", this.onResize.bind(this));
        this.onResize();
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (bean && (bean.naturalHeight > height || bean.naturalWidth > width)) {
            this.rect = {
                width: Math.floor(width * 2),
                height: Math.floor(height * 2),
            };
        } else {
            this.rect = { width: width, height: height };
        }

        this.initDVD(); // reinitialize DVD effect on resize
    }

    // DVD Screensaver Effect
    initDVD() {
        // cancel any existing animation frame
        if (this.dvdframe !== undefined) {
            window.cancelAnimationFrame(this.dvdframe);
            this.dvdframe = undefined;
        }

        /** @type {HTMLCanvasElement} **/
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error("Bean canvas not found");
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
        this.dvd = { canvas: canvas, ctx: ctx, scale: 1.0, margin: 32 };

        const animate = () => {
            this.renderDVD();
            this.dvdframe = window.requestAnimationFrame(animate);
        };
        animate();
    }

    renderDVD() {
        /** @type {HTMLCanvasElement} **/
        const canvas = this.dvd.canvas;
        /** @type {CanvasRenderingContext2D} **/
        const ctx = this.dvd.ctx;
        /** @type {integer} **/
        const margin = this.dvd.margin;

        // fail gracefully if bean or context not ready
        if (!bean || !ctx || !beanBbox) return;

        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const leftEdge = this.xpos + beanBbox.left;
        const rightEdge = this.xpos + beanBbox.right - margin;
        const topEdge = this.ypos + beanBbox.top + margin;
        const bottomEdge = this.ypos + beanBbox.bottom - margin;

        // check if logo is bouncing on the left/right side
        if (leftEdge <= -margin) this.dir.x = 1;
        else if (rightEdge + margin >= canvas.width) this.dir.x = -1;

        // check if logo is bouncing on the top/bottom side
        if (topEdge <= -margin) this.dir.y = 1;
        else if (bottomEdge + margin >= canvas.height) this.dir.y = -1;

        // clamp bottomEdge to below the top of the canvas
        if (bottomEdge < 0) this.ypos = -beanBbox.bottom;
        else if (topEdge > canvas.height) this.ypos = canvas.height;
        // clamp rightEdge to left of the canvas
        if (rightEdge < 0) this.xpos = -beanBbox.right;
        else if (leftEdge > canvas.width) this.xpos = canvas.width;

        // update position
        this.xpos += this.speed * this.dir.x;
        this.ypos += this.speed * this.dir.y;
        // draw the bean image
        ctx.drawImage(bean, this.xpos, this.ypos);
    }
}

// how to tell jshint this is used?
window.beansaver = new DVDScreensaver("div.screen", "bean");
