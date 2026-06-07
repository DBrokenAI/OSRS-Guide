/* ==========================================================
   Confetti — celebration sprinkles on level-up
   ========================================================== */
const Confetti = (() => {
  function fire(opts = {}) {
    const count = opts.count || 80;
    const colors = ['#ff7ab6', '#ff4fa0', '#ffd700', '#e3c6ff', '#ffffff', '#ffd6c2', '#ffc8e0'];
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300;overflow:hidden;';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      const size = 6 + Math.random() * 10;
      const startX = 50 + (Math.random() - 0.5) * 30;
      const endX = startX + (Math.random() - 0.5) * 60;
      const duration = 2000 + Math.random() * 2000;
      const delay = Math.random() * 200;
      const rotation = Math.random() * 720;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const isHeart = Math.random() < 0.3;

      piece.style.cssText = `
        position: absolute;
        left: ${startX}vw;
        top: -20px;
        width: ${size}px; height: ${size}px;
        background: ${isHeart ? 'transparent' : color};
        ${isHeart ? `color: ${color}; font-size: ${size * 2}px; line-height: 1;` : ''}
        border-radius: ${isHeart ? '0' : '2px'};
        animation: confetti-fall ${duration}ms ease-in ${delay}ms forwards;
        --endX: ${endX}vw;
        --rotation: ${rotation}deg;
      `;
      if (isHeart) piece.textContent = '♥';
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 5000);
  }

  // Inject keyframes once
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) translateX(calc(var(--endX) - 50vw)) rotate(var(--rotation)); opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }

  return { fire };
})();
