/* ==========================================================
   Sakura petals — soft floating canvas background
   ========================================================== */
(function () {
  const canvas = document.getElementById('sakura-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  const PETAL_COUNT = Math.min(45, Math.round((W * H) / 32000));
  const SPARKLE_COUNT = 18;

  const petalColors = [
    'rgba(255, 195, 219, 0.85)',
    'rgba(255, 170, 200, 0.78)',
    'rgba(255, 220, 235, 0.85)',
    'rgba(255, 140, 195, 0.72)',
    'rgba(250, 200, 220, 0.85)'
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }

  class Petal {
    constructor(initY) {
      this.reset(initY);
    }
    reset(initY) {
      this.x = rand(-50, W + 50);
      this.y = initY != null ? initY : rand(-H, 0);
      this.size = rand(7, 16);
      this.vy = rand(0.4, 1.2);
      this.vx = rand(-0.6, 0.6);
      this.swing = rand(0.5, 1.5);
      this.swingSpeed = rand(0.005, 0.015);
      this.phase = rand(0, Math.PI * 2);
      this.rot = rand(0, Math.PI * 2);
      this.rotSpeed = rand(-0.02, 0.02);
      this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
      this.opacity = rand(0.6, 1);
    }
    update() {
      this.phase += this.swingSpeed;
      this.x += this.vx + Math.sin(this.phase) * this.swing;
      this.y += this.vy;
      this.rot += this.rotSpeed;
      if (this.y > H + 20 || this.x < -60 || this.x > W + 60) {
        this.reset(-20);
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      // Cute heart-ish petal shape
      ctx.beginPath();
      const s = this.size;
      ctx.moveTo(0, -s * 0.2);
      ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3,  s * 0.2, 0, s);
      ctx.bezierCurveTo(-s * 1.3, s * 0.2, -s * 0.6, -s * 1.1, 0, -s * 0.2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Sparkle {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W);
      this.y = rand(0, H);
      this.size = rand(1, 3);
      this.life = 0;
      this.maxLife = rand(60, 160);
    }
    update() {
      this.life++;
      if (this.life > this.maxLife) this.reset();
    }
    draw() {
      const t = this.life / this.maxLife;
      const a = Math.sin(t * Math.PI);
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.shadowColor = 'rgba(255, 200, 230, 1)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const petals = Array.from({ length: PETAL_COUNT }, () => new Petal(rand(0, H)));
  const sparkles = Array.from({ length: SPARKLE_COUNT }, () => new Sparkle());

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (const s of sparkles) { s.update(); s.draw(); }
    for (const p of petals)   { p.update(); p.draw(); }
    requestAnimationFrame(tick);
  }
  tick();
})();
