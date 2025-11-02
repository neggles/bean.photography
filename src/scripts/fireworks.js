// config options
const numberOfParticles = 42;
const sizeMultiplier = devicePixelRatio || 1;

// color palettes
//const colors = ["#FF007F", "#8000FF", "#4080FF", "#ff4000", "#18FF92"];
// for gay bitches
//const colors = ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"];
// for vampires
const colors = ["#8be9fd", "#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"];

// Determine tap event based on device capabilities
const tapEvent =
    "ontouchstart" in window || navigator.msMaxTouchPoints ? "touchstart" : "mousedown";

// get canvas and context
/** @type {HTMLCanvasElement} **/
const canvas = document.querySelector("canvas.lower");
/** @type {CanvasRenderingContext2D} **/
const ctx = canvas.getContext("2d");

export function setCanvasSize() {
    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;
    ctx.resetTransform();
    ctx.scale(2, 2);
}

// handle window resize
setCanvasSize();
window.addEventListener("resize", setCanvasSize, false);

function setParticleDirection(p, angle_min = 0, angle_max = 360) {
    let angle;
    // Handle zero-crossing case (e.g., 270 to 90 wrapping through 0)
    if (angle_min > angle_max) {
        // Generate random value in [0, range], then add to min and wrap
        const range = 360 - angle_min + angle_max;
        angle = (((angle_min + anime.random(0, range)) % 360) * Math.PI) / 180;
    } else {
        angle = (anime.random(angle_min, angle_max) * Math.PI) / 180;
    }
    const distance = anime.random(384, 640) * sizeMultiplier;
    return {
        x: p.x + distance * Math.cos(angle),
        y: p.y + distance * Math.sin(angle),
    };
}

function createParticle(x, y, angle_min = 0, angle_max = 360) {
    let p = {};
    p.x = x;
    p.y = y;
    p.color = colors[anime.random(0, colors.length - 1)];
    p.radius = anime.random(16, 32);
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
        duration: anime.random(1500, 2000),
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

export function tapHandler(e) {
    const pointerX = e.clientX || e.touches[0].clientX;
    const pointerY = e.clientY || e.touches[0].clientY;
    fireworks(pointerX, pointerY);
}

export const angleSets = {
    any: [0, 360],
    up: [270, 90], // 180° sweep: up (wraps through 0)
    down: [90, 270], // 180° sweep: down
    left: [90, 270], // 180° sweep: left
    right: [270, 90], // 180° sweep: right (wraps through 0)
};

export function fireworks(x, y, direction = "any") {
    render.play();
    animateParticles(x, y, direction);
}

// get URL parameters
const params = new URLSearchParams(window.location.search);
const clickParam = params.get("click");
if (clickParam != null) {
    window.addEventListener(tapEvent, tapHandler, false);
}

export default fireworks;
