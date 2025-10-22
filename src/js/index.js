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

function randInt(min, max) {
    return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

function pickRandomBean() {
    if (randInt(0, 69) == 69) return special_bean;
    return beans[randInt(0, beans.length - 1)];
}

function getBeanImage() {
    let img = document.createElement("img");
    img.src = pickRandomBean();
    img.style.position = "absolute";
    img.style.userSelect = "none";
    img.style.pointerEvents = "none";
    return img;
}

function move(image, x, y) {
    image.style.left = x;
    image.style.top = y;
}

function getImageSizePx(image) {
    // get the dimensions from the width and height attributes
    let width = image.getAttribute("naturalWidth") || image.getAttribute("width");
    let height = image.getAttribute("naturalHeight") || image.getAttribute("height");

    if (width != null && height != null) {
        return { w: parseInt(width), h: parseInt(height) };
    }
    // get the dimensions from the viewBox attribute
    let viewBox = image.getAttribute("viewBox");
    if (viewBox != null) {
        let dimensions = viewBox.split(" ");
        if (dimensions.length == 4) {
            return { w: parseInt(dimensions[2]), h: parseInt(dimensions[3]) };
        }
    }
    // return default dimensions if none are found
    return { w: 512, h: 512 };
}

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

function getBoundingBox(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

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

// const _internal_canvas = new OffscreenCanvas(512, 512);

// function getImageBbox(image) {
//     const ctx = _internal_canvas.getContext("2d");
//     if (!ctx) {
//         console.error("OffscreenCanvas context not found");
//         return null;
//     }
//     ctx.drawImage(image, 0, 0);
//     return getBoundingBox(_internal_canvas);
// }

// constants
const params = new URLSearchParams(window.location.search);
const bean = getBeanImage();
const speed = params.get("speed") || 1.0;

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

    constructor(parent) {
        this.parent = parent;
        if (typeof parent === "string") this.parent = document.querySelector(parent);
        if (!this.parent) throw new Error("Parent not found");

        this.events = {
            resize: this.onResize.bind(this),
        };

        // ensure initial position is within the window bounds so we can catch the bounding box correctly
        this.xpos = randInt(0, window.innerWidth - 512 - 1);
        this.ypos = randInt(0, window.innerHeight - 512 - 1);
        this.dvd = {};
        this.dvdframe = undefined;

        window.addEventListener("resize", this.events.resize, false);

        this.onResize();
        this.initDVD();
    }

    onResize(e) {
        this.rect = {
            width: window.innerWidth,
            height: window.innerHeight,
        };
    }

    // DVD Screensaver Effect
    initDVD() {
        if (this.dvdframe !== undefined) {
            window.cancelAnimationFrame(this.dvd.frame);
            this.dvdframe = undefined;
        }

        const canvas = document.getElementById("dvd");
        if (!canvas) {
            console.error("DVD canvas not found");
            return;
        }
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            console.error("DVD canvas context not found");
            return;
        }

        canvas.width = this.rect.width * 0.8;
        canvas.height = this.rect.height * 0.8;
        this.dvd = { canvas: canvas, ctx: ctx, bbox: null };

        const animate = () => {
            this.renderDVD();
            this.dvdframe = window.requestAnimationFrame(animate);
        };
        animate();
    }

    renderDVD() {
        const canvas = this.dvd.canvas;
        if (!canvas) return;
        const ctx = this.dvd.ctx;

        // move the logo to the current X and Y coords
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bean, this.xpos, this.ypos);

        // get the bounding box of the bean image
        if (!this.dvd.bbox) {
            let bbox = getBoundingBox(canvas);
            if (bbox) this.dvd.bbox ??= bbox;
        }

        if (this.dvd.bbox != null) {
            // ok so we're storing top-left corner of image object but we want our collision check to use 10px
            // in from the actual non-transparent image bbox
            const offset = 10;

            const leftEdge = this.xpos + -offset;
            const rightEdge = this.xpos + (this.dvd.bbox.left + this.dvd.bbox.width) + offset;
            const topEdge = this.ypos + this.dvd.bbox.top - offset;
            const bottomEdge = this.ypos + (this.dvd.bbox.top + this.dvd.bbox.height) + offset;

            // check if logo is bouncing on the left/right side
            if (leftEdge <= 1) {
                changeDirection("x", 1);
            } else if (rightEdge + 1 >= this.rect.width) {
                changeDirection("x", -1);
            }

            // check if logo is bouncing on the top/bottom side
            if (topEdge <= 1) {
                changeDirection("y", 1);
            } else if (bottomEdge + 1 >= this.rect.height) {
                changeDirection("y", -1);
            }

            // update position, we'll write the image in its new position in the next frame
            this.xpos += speed * direction.x;
            this.ypos += speed * direction.y;
        }
    }
}

var pageEffects = new PageEffects("div.screen");
