// config options
const numberOfParticles = 42;
const sizeMultiplier = devicePixelRatio || 1;

// color palettes
//const colors = ["#FF007F", "#8000FF", "#4080FF", "#ff4000", "#18FF92"];
// for gay bitches
//const colors = ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"];
// for vampires
const colors = ["#8be9fd", "#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"];

// get canvas and context
/** @type {HTMLCanvasElement} **/
const canvas = document.querySelector("canvas.lower");
/** @type {CanvasRenderingContext2D} **/
const ctx = canvas.getContext("2d");

export function onResize() {
    canvas.width = window.innerWidth * 2 * devicePixelRatio;
    canvas.height = window.innerHeight * 2 * devicePixelRatio;
    ctx.resetTransform();
    ctx.scale(2, 2);
}

// handle window resize
onResize();
window.addEventListener("resize", onResize, false);

// generate a random integer between min and max, inclusive. assumes integer inputs
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setParticleDirection(p, angle_min = 0, angle_max = 360) {
    let angle;
    // decrement max by 1 to make range inclusive
    angle_max -= 1;
    // handle zero crossing
    const range = angle_max < angle_min ? 360 - angle_min + angle_max : angle_max - angle_min;
    // generate angle, wrapping if necessary, and offsetting to make 0 = up
    angle = (angle_min + randInt(0, range) - 90) % 360;
    // generate distance
    const distance = randInt(384, 640) * sizeMultiplier;
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

export function tapHandler(e) {
    const pointerX = e.clientX || e.touches[0].clientX;
    const pointerY = e.clientY || e.touches[0].clientY;
    fireworks(pointerX, pointerY);
}

export default fireworks;
