import { useEffect, useRef } from 'react';
import { onConfetti } from '../../lib/events';

const COLORS = ['#a78bfa', '#22d3ee', '#f472b6', '#34d399', '#facc15', '#fb923c'];

/** Dependency-free canvas confetti. Trigger with fireConfetti({ count, origin }). */
export default function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of particles) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      raf = particles.length ? requestAnimationFrame(loop) : 0;
    };

    const off = onConfetti(({ count = 140, origin = { x: 0.5, y: 0.35 } } = {}) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const ox = origin.x * window.innerWidth;
      const oy = origin.y * window.innerHeight;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 6,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 110 + Math.random() * 60,
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    });

    return () => {
      off();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[80] h-full w-full" aria-hidden />;
}
