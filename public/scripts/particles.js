const canvas = document.getElementById("particles-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];
const colors = ["#FFFFFF", "#FFD700", "#FFE4E1", "#ADD8E6", "#E0FFFF"]; // white, gold, cute pink, light blue, soft cyan

class StarParticle {
  constructor(x, y, color, size, shape) {
    this.x = x;
    this.y = y;
    this.size = size || Math.random() * 3 + 1;
    this.color = color || colors[Math.floor(Math.random() * colors.length)];
    this.speedX = Math.random() * 2 - 1;
    this.speedY = Math.random() * 2 - 1;
    this.opacity = Math.random() * 0.5 + 0.5;
    this.fadeSpeed = Math.random() * 0.01 + 0.002;
    this.shape = shape || (Math.random() > 0.5 ? "circle" : "star");
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.opacity -= this.fadeSpeed;
    if (this.opacity <= 0) {
      // Respawn like a phoenix~! 🔥🌟
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.opacity = Math.random() * 0.5 + 0.5;
      this.size = Math.random() * 3 + 1;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.shape = Math.random() > 0.5 ? "circle" : "star";
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    if (this.shape === "circle") {
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    } else {
      drawStar(ctx, this.x, this.y, 5, this.size, this.size / 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

// Helper function to draw a star shape~ 🌟
function drawStar(ctx, x, y, points, outerRadius, innerRadius) {
  const step = Math.PI / points;
  ctx.moveTo(x, y - outerRadius);
  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
  }
  ctx.closePath();
}

function createParticles(amount) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    particles.push(new StarParticle(x, y));
  }
}

function animateParticles() {
  if (canvas.offsetParent !== null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });
  }
  requestAnimationFrame(animateParticles);
}

// Magic starts here! ✨
createParticles(150); // You can change 150 for more or fewer stars
animateParticles();

// Optional: Make canvas resize friendly!
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
