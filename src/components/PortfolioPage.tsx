import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Facebook, Github, Instagram, Mail, Menu, MessageCircle, Music2, Send, X, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CursorTrail } from "./CursorTrail";
import { VillageWorld, ZONES, type Phase } from "./VillageWorld";

const socials = [
  { icon: Mail, label: "Email", href: "mailto:hello@mewostudios.com" },
  { icon: MessageCircle, label: "WhatsApp", href: "https://wa.me/" },
  { icon: Send, label: "Telegram", href: "https://t.me/" },
  { icon: Facebook, label: "Facebook", href: "https://facebook.com" },
  { icon: Youtube, label: "YouTube", href: "https://youtube.com" },
  { icon: Music2, label: "TikTok", href: "https://tiktok.com" },
  { icon: Instagram, label: "Instagram", href: "https://instagram.com" },
  { icon: Github, label: "GitHub", href: "https://github.com" },
];

const CONTENT = [
  { tag: "Entrance", title: "Welcome to Mewo Valley", body: "3D Product Visualization & Game-Ready Asset Artistry | Unity Game Developer. Scroll, drag, or tap a market building to explore.", points: ["Blender · Unity · C#", "Stills, motion & real-time", "Desktop and mobile friendly"] },
  { tag: "Market 01", title: "3D Product Visualization Market", body: "High-end product renders, ad animations, and photoreal 3D models crafted with studio-grade lighting and materials.", points: ["Fast 1-day turnaround lane", "Repeat client loyalty discount", "Ad-ready motion loops"] },
  { tag: "Market 02", title: "Game Asset Mall", body: "Game-ready props and environments with clean topology, efficient UVs, and wireframe previews.", points: ["360° inspectable models", "Wireframe & texel-density previews", "PBR texture sets"] },
  { tag: "Market 03", title: "Unity C# Arcade Hub", body: "Interactive Unity prototypes and C# gameplay mechanics — from controllers to full game loops.", points: ["Gameplay systems in C#", "Playable prototypes", "Performance-tuned builds"] },
  { tag: "Square", title: "Post & Social Square", body: "Pick a channel and let's build something real together.", points: [] },
];

export function PortfolioPage() {
  const [phase, setPhase] = useState<Phase>("Day");
  const [zone, setZone] = useState(0);
  const [modal, setModal] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setZone(Math.min(ZONES.length - 1, Math.floor(v * ZONES.length * 0.999)));
  });

  const goTo = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + (max * (i + 0.5)) / ZONES.length, behavior: "smooth" });
  };

  useEffect(() => { if (window.location.hash === "#contact") goTo(4); }, []);

  const c = CONTENT[zone]!;

  return (
    <main className="bg-background text-foreground">
      <CursorTrail />
      <div className="village-canvas fixed inset-0">
        <VillageWorld zone={zone} selected={modal} onPhase={setPhase} onSelect={(i) => { goTo(i); setModal(i); }} />
      </div>
      <div className="pointer-events-none fixed inset-0 village-vignette" />

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 md:px-10">
        <button onClick={() => goTo(0)} className="flex items-center gap-3" aria-label="Mewo Studios home">
          <span className="brand-mark">M</span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.16em]">Mewo Studios</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => { goTo(4); setModal(4); }} className="nav-cta">Start a project <ArrowUpRight size={15} /></button>
          <button onClick={() => setModal(zone)} className="icon-control" aria-label="Open zone details"><Menu size={18} /></button>
        </div>
      </header>

      {/* Right-side brand typography */}
      <div
        className="brand-safe fixed right-5 top-24 z-30 max-w-[15rem] text-right md:right-10 md:top-32 md:max-w-sm"
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setTilt({ x: ((e.clientX - b.left) / b.width - 0.5) * 14, y: ((e.clientY - b.top) / b.height - 0.5) * -14 });
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <motion.div animate={{ rotateY: tilt.x, rotateX: tilt.y }} transition={{ type: "spring", stiffness: 140, damping: 16 }}>
          <p className="eyebrow mb-3">{c.tag}</p>
          <h1 className="brand-title font-display font-extrabold uppercase">Mewo<br /><span className="text-stroke">Studios</span></h1>
        </motion.div>
      </div>

      {/* Zone card */}
      <AnimatePresence mode="wait">
        <motion.aside
          key={zone}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          className="glass fixed bottom-24 right-5 z-30 w-[min(22rem,calc(100vw-2.5rem))] p-5 md:bottom-10 md:right-10"
        >
          <h2 className="font-display text-xl font-semibold">{c.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.body}</p>
          <button onClick={() => setModal(zone)} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Open details <ArrowUpRight size={14} />
          </button>
        </motion.aside>
      </AnimatePresence>

      {/* Auto time-of-day indicator */}
      <div className="glass fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] md:bottom-10 md:left-10 md:translate-x-0">
        <span className="status-dot" /> {phase}
      </div>
      <nav className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:left-10 md:flex">
        {CONTENT.map((z, i) => (
          <button key={z.tag} onClick={() => goTo(i)} className={`zone-dot ${zone === i ? "is-active" : ""}`}><span>{z.title}</span></button>
        ))}
      </nav>

      <AnimatePresence>
        {modal !== null && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="glass relative w-full max-w-lg p-7" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}>
              <button className="icon-control absolute right-4 top-4" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button>
              <p className="eyebrow mb-3">{CONTENT[modal]!.tag}</p>
              <h3 className="font-display text-3xl font-semibold">{CONTENT[modal]!.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{CONTENT[modal]!.body}</p>
              {CONTENT[modal]!.points.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {CONTENT[modal]!.points.map((p) => <li key={p} className="flex items-center gap-3 text-sm"><span className="status-dot" />{p}</li>)}
                </ul>
              )}
              {modal === 4 && (
                <div className="mt-6 grid grid-cols-4 gap-3">
                  {socials.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="social-tile"><s.icon size={20} /><span>{s.label}</span></a>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll driver */}
      <div ref={scrollRef} className="pointer-events-none relative" style={{ height: `${ZONES.length * 100}svh` }} />
    </main>
  );
}
