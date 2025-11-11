import beans from "./beans.js";
import { fireworks, tapHandler } from "./fireworks.js";

// get special bean
const special_bean = beans.special_bean;
// get URL parameters
const params = new URLSearchParams(window.location.search);
// get local storage
const storage = window.localStorage;

// check if click parameter is present
const clickParam = params.get("click");

// track last bean so we don't repeat it
let lastBean = storage.getItem("lastBean");
// track page load count
let loadCount = parseInt(storage.getItem("loadCount") || "0", 10);
loadCount += 1;
storage.setItem("loadCount", loadCount.toString());

// get tap event based on device capabilities
const tapEvent =
    "ontouchstart" in window || navigator.msMaxTouchPoints ? "touchstart" : "mousedown";

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

    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: right - left,
        height: bottom - top,
    };
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
var beanBox = null;
// load the bean image and compute its bounding box once loaded
/** @type {HTMLImageElement} **/
const bean = getBeanImage((img) => {
    beanBox = getImageBbox(img);
    // log the bean bounding box for debugging purposes
    if (beanBox) console.debug("Bean bounding box:", beanBox);
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
const speedParam = parseSpeed(params);

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

        // set initial speed
        this.speed = speedParam;
        // distance past edges before bouncing
        this.margin = 32 * devicePixelRatio;

        // DVD effect state
        this.dvd = {};
        // animation frame handle
        this.dvdframe = undefined;

        // initial direction
        this.dir = { x: randInt(0, 1) === 0 ? -1 : 1, y: randInt(0, 1) === 0 ? -1 : 1 };

        // bind event handlers and call for initial setup
        window.addEventListener("resize", this.onResize.bind(this));
        window.addEventListener("orientationchange", this.onResize.bind(this));
        window.addEventListener("load", this.onResize.bind(this));
    }

    onResize() {
        // get new canvas size in device pixels
        const widthPx = window.innerWidth * devicePixelRatio;
        const heightPx = window.innerHeight * devicePixelRatio;

        // adjust canvas size for displays which don't report devicePixelRatio correctly
        if (bean && (bean.naturalHeight > heightPx || bean.naturalWidth > widthPx)) {
            this.rect = { width: Math.floor(widthPx * 2), height: Math.floor(heightPx * 2) };
        } else {
            this.rect = { width: widthPx, height: heightPx };
        }

        // adjust speed for devicePixelRatio
        this.speed = speedParam * (devicePixelRatio || 1);

        // reinitialize animation
        this.initDVD();
    }

    // DVD Screensaver Effect
    initDVD() {
        // cancel any existing animation frame
        if (this.dvdframe !== undefined) {
            window.cancelAnimationFrame(this.dvdframe);
            this.dvdframe = undefined;
        }

        /** @type {HTMLCanvasElement} **/
        this.canvas = document.querySelector(`canvas#${this.canvasId}`);
        if (!this.canvas) {
            console.error("Bean canvas not found");
            return;
        }
        /** @type {CanvasRenderingContext2D} **/
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
        if (!this.ctx) {
            console.error("DVD canvas context not found");
            return;
        }

        // set canvas size
        this.canvas.width = this.rect.width;
        this.canvas.height = this.rect.height;

        const animate = () => {
            this.renderDVD();
            this.dvdframe = window.requestAnimationFrame(animate);
        };
        animate();
    }

    renderDVD() {
        /** @type {HTMLCanvasElement} **/
        const canvas = this.canvas;
        if (!canvas) return;
        /** @type {CanvasRenderingContext2D} **/
        const ctx = this.ctx;
        if (!ctx) return;

        // fail gracefully if bean or context not ready
        if (!bean || !beanBox) return;

        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let effect = { xpos: null, ypos: null, direction: null };

        const left = this.xpos + beanBox.left;
        const right = this.xpos + beanBox.right;
        const top = this.ypos + beanBox.top;
        const bottom = this.ypos + beanBox.bottom;

        // check for left/right bounce
        if (left <= -this.margin) {
            this.dir.x = 1;
            // calculate collision point for fireworks
            effect.xpos = left;
            effect.direction = "right";
        } else if (right >= canvas.width + this.margin) {
            this.dir.x = -1;
            // calculate collision point for fireworks
            effect.xpos = right;
            effect.direction = "left";
        }
        // check for top/bottom bounce
        if (top <= -this.margin) {
            this.dir.y = 1;
            effect.ypos = top;
            effect.direction = "down";
        } else if (bottom >= canvas.height + this.margin) {
            this.dir.y = -1;
            effect.ypos = bottom;
            effect.direction = "up";
        }

        if (effect.direction !== null) {
            effect.ypos ??= this.ypos + (beanBox.top + beanBox.bottom) / 2;
            effect.xpos ??= this.xpos + (beanBox.left + beanBox.right) / 2;
            fireworks(effect.xpos, effect.ypos, effect.direction);
        }

        // check for left/right overshoot and correct position
        if (left + beanBox.width < 0) this.xpos = -beanBox.left;
        else if (right - beanBox.width > canvas.width) this.xpos = canvas.width - beanBox.right;
        // check for top/bottom overshoot and correct position
        if (top + beanBox.height < 0) this.ypos = -beanBox.top;
        else if (bottom - beanBox.height > canvas.height)
            this.ypos = canvas.height - beanBox.bottom;

        // update position
        this.xpos += this.speed * this.dir.x;
        this.ypos += this.speed * this.dir.y;
        // draw the bean image
        ctx.drawImage(bean, this.xpos, this.ypos);
    }
}

window.beansaver = new DVDScreensaver("div.screen", "bean");

if (clickParam != null) {
    window.addEventListener(tapEvent, tapHandler, false);
}
