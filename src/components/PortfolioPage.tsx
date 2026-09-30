import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Box, Code2, Github, Mail, Menu, Send, Sparkles, Zap } from "lucide-react";
import { useRef } from "react";
import { CursorTrail } from "./CursorTrail";
import { InteractiveScene } from "./InteractiveScene";

const services = [
  { icon: Sparkles, number: "01", title: "Product visualization", copy: "Photoreal product renders and ad-ready motion with meticulous materials, lighting, and composition." },
  { icon: Box, number: "02", title: "Game-ready assets", copy: "Optimized props and environments built for clean topology, efficient UVs, and real-time performance." },
  { icon: Zap, number: "03", title: "One-day delivery", copy: "A focused rapid-production lane for briefs that need polished results without the long studio timeline." },
  { icon: Code2, number: "04", title: "Unity development", copy: "Interactive prototypes and gameplay systems bridging Blender craft with Unity and C#." },
];

const works = [
  { title: "ORBIT / 01", type: "Product film", className: "work-orbit md:col-span-2" },
  { title: "VOID RUNNER", type: "Game-ready asset", className: "work-void" },
  { title: "CHROMA CORE", type: "Unity prototype", className: "work-chroma" },
];

export function PortfolioPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <main className="overflow-clip bg-background text-foreground">
      <CursorTrail />
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <a href="#top" className="pointer-events-auto flex items-center gap-3" aria-label="Mewo Studios home">
          <span className="brand-mark">M</span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.16em]">Mewo Studios</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="#contact" className="nav-cta">Start a project <ArrowUpRight size={15} /></a>
          <a href="#work" className="icon-control" aria-label="Open work menu"><Menu size={18} /></a>
        </div>
      </header>

      <section id="top" ref={heroRef} className="relative min-h-[105svh] touch-pan-y">
        <div className="absolute inset-0"><InteractiveScene /></div>
        <div className="hero-shade absolute inset-0 pointer-events-none" />
        <motion.div style={{ y: titleY, opacity: titleOpacity }} className="pointer-events-none absolute inset-x-0 top-[17svh] z-10 mx-auto flex max-w-7xl flex-col items-center px-6 text-center">
          <p className="eyebrow mb-5">Independent 3D art & interactive studio</p>
          <h1 className="font-display text-[clamp(3.35rem,10vw,9rem)] font-extrabold uppercase leading-[0.82] tracking-normal">
            Mewo<br /><span className="text-stroke">Studios</span>
          </h1>
          <p className="mt-7 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
            3D product visualization & game-ready asset artistry, engineered for impact in stills, motion, and real-time worlds.
          </p>
        </motion.div>
        <div className="absolute bottom-8 left-5 z-20 hidden items-center gap-3 text-xs uppercase text-muted-foreground md:flex md:left-10">
          <span className="status-dot" /> Available for selected projects
        </div>
        <a href="#studio" className="scroll-cue" aria-label="Explore the studio"><ArrowDown size={18} /></a>
        <p className="absolute bottom-8 right-5 z-20 max-w-44 text-right text-[10px] uppercase leading-4 text-muted-foreground md:right-10">
          Drag to orbit · move to react · scroll to explore
        </p>
      </section>

      <section id="studio" className="section-band relative z-20 py-24 md:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[0.65fr_1.35fr] md:px-10">
          <div>
            <p className="section-index">01 / Studio focus</p>
          </div>
          <div>
            <h2 className="font-display max-w-4xl text-4xl font-semibold leading-tight md:text-7xl">
              Visual craft that moves from <span className="text-accent">imagination</span> to engine.
            </h2>
            <div className="mt-12 grid gap-8 border-t border-border pt-8 text-muted-foreground md:grid-cols-2">
              <p className="leading-7">Mewo Studios creates hyper-real product renders, advertising motion, and optimized game assets using Blender and Unity.</p>
              <p className="leading-7">Every frame balances tactile detail with real-time discipline—built to look exceptional and perform where it matters.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band relative z-20 border-t border-border py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <p className="section-index mb-12">02 / Capabilities</p>
          <div className="divide-y divide-border border-y border-border">
            {services.map((service, index) => (
              <motion.article
                key={service.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15%" }}
                transition={{ delay: index * 0.08 }}
                className="service-row group"
              >
                <span className="text-xs text-muted-foreground">{service.number}</span>
                <service.icon className="text-accent" size={24} strokeWidth={1.5} />
                <h3 className="font-display text-2xl font-semibold md:text-4xl">{service.title}</h3>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">{service.copy}</p>
                <ArrowUpRight className="service-arrow" size={22} />
              </motion.article>
            ))}
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">Returning clients receive priority scheduling and loyalty pricing.</p>
        </div>
      </section>

      <section id="work" className="section-band relative z-20 border-t border-border py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div><p className="section-index mb-5">03 / Selected work</p><h2 className="font-display text-5xl font-semibold md:text-7xl">Built to inspect.</h2></div>
            <p className="hidden max-w-xs text-right text-sm leading-6 text-muted-foreground md:block">Move across each study. The surfaces react like objects, not static thumbnails.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {works.map((work) => (
              <article key={work.title} className={`work-card ${work.className}`}>
                <div className="work-object"><span /><i /></div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{work.type}</p><h3 className="mt-2 font-display text-2xl font-semibold">{work.title}</h3></div>
                  <span className="icon-control"><ArrowUpRight size={18} /></span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="contact-band relative z-20 py-24 md:py-36">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 md:grid-cols-2 md:px-10">
          <div>
            <p className="section-index mb-6">04 / Contact</p>
            <h2 className="font-display text-5xl font-semibold leading-[0.95] md:text-8xl">Let’s make it <span className="text-stroke-accent">real.</span></h2>
            <div className="mt-10 flex gap-3">
              <a className="icon-control" href="mailto:hello@mewostudios.com" aria-label="Email"><Mail size={18} /></a>
              <a className="icon-control" href="https://github.com" aria-label="GitHub"><Github size={18} /></a>
            </div>
          </div>
          <form className="contact-form" onSubmit={(event) => event.preventDefault()}>
            <label>Name<input name="name" placeholder="Your name" /></label>
            <label>Email<input type="email" name="email" placeholder="you@company.com" /></label>
            <label>Tell us about the project<textarea name="message" rows={4} placeholder="Scope, timeline, and what you want to create" /></label>
            <button type="submit" className="submit-button">Send inquiry <Send size={16} /></button>
          </form>
        </div>
      </section>
      <footer className="relative z-20 flex flex-col gap-4 border-t border-border bg-background px-5 py-8 text-xs uppercase tracking-[0.12em] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Mewo Studios</span><span>3D · Motion · Real-time</span>
      </footer>
    </main>
  );
}