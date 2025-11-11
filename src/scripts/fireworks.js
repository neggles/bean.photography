// config options
const numberOfParticles = 42;
const sizeMultiplier = devicePixelRatio > 1 ? devicePixelRatio - 1 : devicePixelRatio;

// for vampires
export const colors = [
    "#ffffff",
    "#8be9fd",
    "#50fa7b",
    "#ffb86c",
    "#ff79c6",
    "#bd93f9",
    "#ff5555",
    "#f1fa8c",
];

// get canvas and context
/** @type {HTMLCanvasElement} **/
const canvas = document.querySelector("canvas.lower");
/** @type {CanvasRenderingContext2D} **/
const ctx = canvas.getContext("2d");

// generate a random integer between min and max, inclusive. assumes integer inputs
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function onResize() {
    // get new canvas size in device pixels
    const widthPx = window.innerWidth * devicePixelRatio;
    const heightPx = window.innerHeight * devicePixelRatio;
    // adjust canvas size for displays which don't report devicePixelRatio correctly
    canvas.width = Math.floor(widthPx * devicePixelRatio);
    canvas.height = Math.floor(heightPx * devicePixelRatio);
    // scale context to account for device pixel ratio
    if (ctx) {
        ctx.resetTransform();
        ctx.scale(devicePixelRatio, devicePixelRatio);
    }
}

// handle window resize
window.addEventListener("load", onResize);
window.addEventListener("resize", onResize);

function setParticleDirection(p, angle_min = 0, angle_max = 360) {
    let angle;
    // decrement max by 1 to make range inclusive
    angle_max -= 1;
    // handle zero crossing
    const range = angle_max < angle_min ? 360 - angle_min + angle_max : angle_max - angle_min;
    // generate angle, wrapping if necessary, and offsetting to make 0 = up
    angle = (angle_min + randInt(0, range) - 90) % 360;
    // generate distance
    const distance = randInt(512, 640) * sizeMultiplier;
    return {
        x: p.x + Math.floor(distance * Math.cos((angle * Math.PI) / 180)),
        y: p.y + Math.floor(distance * Math.sin((angle * Math.PI) / 180)),
    };
}

function createParticle(x, y, angle_min = 0, angle_max = 360) {
    let p = {};
    p.x = x;
    p.y = y;
    p.color = colors[randInt(0, colors.length - 1)];
    p.radius = randInt(16, 32);
    p.endPos = setParticleDirection(p, angle_min, angle_max);
    p.draw = () => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, true);
        ctx.fillStyle = p.color;
        ctx.fill();
    };
    return p;
}

function renderParticle(anim) {
    for (let i = 0; i < anim.animatables.length; i++) {
        anim.animatables[i].target.draw();
    }
}

function animateParticles(x, y, direction = "any") {
    let particles = [];
    for (let i = 0; i < numberOfParticles; i++) {
        particles.push(createParticle(x, y, ...angleSets[direction]));
    }
    anime.timeline().add({
        targets: particles,
        x: (p) => p.endPos.x,
        y: (p) => p.endPos.y,
        radius: 0.1,
        duration: randInt(1500, 2000),
        easing: "easeOutExpo",
        update: renderParticle,
    });
}

const render = anime({
    duration: Infinity,
    update: function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
});

export const angleSets = {
    any: [0, 360],
    up: [270, 90], // 180° sweep: up (wraps through 0)
    down: [90, 270], // 180° sweep: down
    left: [180, 360], // 180° sweep: left
    right: [0, 180], // 180° sweep: right
};

export function fireworks(x, y, direction = "any") {
    render.play();
    animateParticles(x, y, direction);
}

export default fireworks;
