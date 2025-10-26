const beans = [
    "/beans/bean1.png",
    "/beans/bean2.png",
    "/beans/bean3.png",
    "/beans/bean4.png",
    "/beans/bean5.png",
    "/beans/bean6.png",
    "/beans/bean7.png",
];
const special_bean = "/beans/beanlet.png";

const storage = window.localStorage;

// track last bean so we don't repeat it
let lastBean = storage.getItem("lastBean");

// track page load count
let loadCount = parseInt(storage.getItem("loadCount") || "0", 10);
loadCount += 1;
storage.setItem("loadCount", loadCount.toString());

function randInt(min, max) {
    return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

// pick a bean image source URL based on some conditions. is only expected to be called once per page load.
function pickBeanSrc() {
    if (randInt(0, 69) === 69 || loadCount === 42) {
        console.info("You found the special bean! 🎉");
        // reset load count
        storage.setItem("loadCount", "0");
        storage.setItem("lastBean", special_bean);
        return special_bean;
    } else {
        let bean;
        do {
            bean = beans[randInt(0, beans.length - 1)];
        } while (bean === lastBean && beans.length > 1);
        storage.setItem("lastBean", bean);
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
    img.style.display = "none";
    img.style.position = "absolute";
    img.src = pickBeanSrc();
    return img;
}

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

// constants
const params = new URLSearchParams(window.location.search);
let beanBbox = null;
let speed = 1.0;

/** @type {HTMLImageElement} **/
const bean = getBeanImage((img) => {
    beanBbox = getImageBbox(img);
    if (beanBbox) {
        console.log("Bean bounding box:", beanBbox);
    } else {
        console.log("Could not determine bean bounding box");
    }
    // speed in pixels per frame
    pageEffects.speed = parseFloat(params.get("speed")) || 1.0;
});

// variables
let direction = { x: randInt(0, 1) === 0 ? -1 : 1, y: randInt(0, 1) === 0 ? -1 : 1 };

function changeDirection(axis, value) {
    direction[axis] = value;
}

class PageEffects {
    xpos;
    ypos;
    rect;
    dvd;
    dvdframe;
    parent;
    speed;
    events = {};

    constructor(parent) {
        /** @type {HTMLElement} **/
        this.parent = typeof parent === "string" ? document.querySelector(parent) : parent;
        if (!this.parent) throw new Error("Parent not found");

        // event handlers
        this.events = { resize: this.onResize.bind(this) };

        // ensure initial position is within the window bounds
        this.xpos = randInt(1, window.innerWidth - 1);
        this.ypos = randInt(1, window.innerHeight - 1);

        this.dvd = {};
        this.dvdframe = undefined;
        this.speed = 1.0;

        window.addEventListener("resize", this.events.resize, false);

        this.onResize();
        this.initDVD();
    }

    onResize(e) {
        this.rect = { width: window.innerWidth, height: window.innerHeight };
        this.initDVD(); // reinitialize DVD effect on resize
    }

    // DVD Screensaver Effect
    initDVD() {
        if (this.dvdframe !== undefined) {
            window.cancelAnimationFrame(this.dvd.frame);
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
        this.dvd = { canvas: canvas, ctx: ctx, isize: null, bbox: null };

        const animate = () => {
            this.renderDVD();
            this.dvdframe = window.requestAnimationFrame(animate);
        };
        animate();
    }

    renderDVD() {
        // early out if bean image is not loaded yet

        if (!bean) return;

        /** @type {HTMLCanvasElement} **/
        const canvas = this.dvd.canvas;
        /** @type {CanvasRenderingContext2D} **/
        const ctx = this.dvd.ctx;
        if (!ctx) return;

        // clear canvas and draw bean at current position
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bean, this.xpos, this.ypos);

        if (beanBbox) {
            const margin = 32;

            const leftEdge = this.xpos + beanBbox.left + margin;
            const rightEdge = this.xpos + beanBbox.right - margin;
            const topEdge = this.ypos + beanBbox.top + margin;
            const bottomEdge = this.ypos + beanBbox.bottom - margin;

            // check if logo is bouncing on the left/right side
            if (leftEdge <= 1) changeDirection("x", 1);
            else if (rightEdge + 1 >= this.rect.width) changeDirection("x", -1);

            // check if logo is bouncing on the top/bottom side
            if (topEdge <= 1) changeDirection("y", 1);
            else if (bottomEdge + 1 >= this.rect.height) changeDirection("y", -1);

            // update position, we'll write the image in its new position in the next frame
            this.xpos += this.speed * direction.x;
            this.ypos += this.speed * direction.y;
        }
    }
}

var pageEffects = new PageEffects("div.screen");
