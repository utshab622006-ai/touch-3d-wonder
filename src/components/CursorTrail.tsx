import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; life: number; size: number };

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const particles: Particle[] = [];
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const add = (x: number, y: number) => {
      particles.push({ x, y, life: 1, size: 5 + (particles.length % 4) * 2 });
      if (particles.length > 70) particles.shift();
    };
    const move = (event: PointerEvent) => add(event.clientX, event.clientY);
    const draw = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.globalCompositeOperation = "lighter";
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        if (!particle) continue;
        particle.life -= 0.028;
        particle.size *= 0.985;
        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }
        const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 2.4);
        gradient.addColorStop(0, `rgba(92, 235, 255, ${particle.life * 0.8})`);
        gradient.addColorStop(0.42, `rgba(255, 66, 194, ${particle.life * 0.38})`);
        gradient.addColorStop(1, "rgba(8, 12, 20, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * 2.4, 0, Math.PI * 2);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50 hidden md:block" aria-hidden="true" />;
}