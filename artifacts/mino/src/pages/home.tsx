import { Link } from "wouter";
import { FadeIn } from "@/components/fade-in";
import { WaitlistForm } from "@/components/waitlist-form";

import minoWordmark from "@/assets/mino-wordmark.png";
import glpStrongImg from "@assets/Gemini_Generated_Image_k838m4k838m4k838_1777231083630.png";
import motscImg from "@assets/Gemini_Generated_Image_2rm7q02rm7q02rm7_1777237606776.png";
import ghkCuImg from "@assets/Gemini_Generated_Image_4g4ywi4g4ywi4g4y_1777237606776.png";
import hairImg from "@assets/hires/hair_hires.webp";
import productImg from "@assets/IMG_9536_1777220301014.PNG";
import quoteImg from "@assets/hires/quote_longevity.png";
import brochureImg from "@assets/hires/brochure_hires.webp";

const TRUST_ITEMS = [
  "Clinically formulated",
  "Provider vetted",
  "Quality certified",
  "Partner trusted",
];

// Anchor targets for the Field Guide deep links surfaced in the top
// nav. Each entry renders one category card and is the scroll target
// for its corresponding nav dropdown link.
type FieldGuidePeptide = {
  name: string;
  role: string;
  doses: string;
};

type FieldGuideCategory = {
  id: string;
  label: string;
  intro: string;
  peptides: FieldGuidePeptide[];
};

const FIELD_GUIDE: FieldGuideCategory[] = [
  {
    id: "editorial-cognitive",
    label: "Cognitive Enhancement",
    intro:
      "Peptides that cross the blood–brain barrier to enhance memory, focus, mood, and neuroprotection.",
    peptides: [
      { name: "Semax", role: "ACTH-derived nootropic", doses: "5, 10, 30 mg" },
      { name: "Selank", role: "Anxiolytic nootropic", doses: "10 mg" },
      { name: "Pinealon", role: "CNS bioregulator", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-growth-hormone",
    label: "Growth Hormone Optimization",
    intro:
      "Stimulate the body's own GH production for sleep, body composition, recovery, and vitality — without exogenous replacement.",
    peptides: [
      { name: "CJC-1295", role: "GHRH analog", doses: "2 mg ± DAC" },
      { name: "Ipamorelin", role: "Selective secretagogue", doses: "5 mg" },
      { name: "Tesamorelin", role: "FDA-approved GHRH", doses: "5 mg" },
      { name: "Hexarelin", role: "GH secretagogue", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-longevity",
    label: "Longevity & Cellular Health",
    intro:
      "Target the fundamental mechanisms of cellular aging — mitochondrial function, NAD+ depletion, telomere maintenance, and senescence.",
    peptides: [
      { name: "NAD+", role: "Cellular energy coenzyme", doses: "500, 1000 mg" },
      { name: "MOTS-c", role: "Exercise mimetic", doses: "10, 40 mg" },
      { name: "Klotho", role: "Longevity protein", doses: "1, 5 mg" },
      { name: "Epithalon", role: "Telomerase activator", doses: "10 mg" },
      { name: "SS-31", role: "Mitochondrial peptide", doses: "10, 30 mg" },
      { name: "FoxO4-DRI", role: "Senolytic peptide", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-recovery",
    label: "Recovery & Healing",
    intro:
      "Accelerate natural repair — healing injuries faster, reducing inflammation, and supporting tissue regeneration.",
    peptides: [
      { name: "BPC-157", role: "Body protection compound", doses: "5, 10 mg" },
      { name: "TB-500", role: "Thymosin Beta-4", doses: "2, 5, 10 mg" },
      { name: "BPC + TB", role: "Synergistic blend", doses: "10, 20 mg" },
      { name: "Wolverine", role: "BPC + TB + GHK-Cu repair blend", doses: "20 mg" },
      { name: "KLOW", role: "KPV + LL-37 + Oxytocin + Wolverine blend", doses: "30 mg" },
      { name: "LL-37", role: "Antimicrobial peptide", doses: "10 mg" },
      { name: "KPV", role: "Anti-inflammatory tripeptide", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-sexual-wellness",
    label: "Sexual Wellness & Intimacy",
    intro:
      "Addressing desire, arousal, and connection through neurological and endocrine pathways.",
    peptides: [
      { name: "PT-141", role: "Melanocortin agonist (FDA)", doses: "10 mg" },
      { name: "Oxytocin", role: "Bonding hormone", doses: "10 mg" },
      { name: "Kisspeptin", role: "GnRH master switch", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-skin",
    label: "Skin & Aesthetics",
    intro:
      "Stimulate collagen production, improve skin architecture, and support visible rejuvenation from the cellular level.",
    peptides: [
      { name: "GHK-Cu", role: "Copper peptide", doses: "50, 100 mg" },
      { name: "GLOW Blend", role: "BPC + TB + GHK-Cu", doses: "70 mg" },
      { name: "Melanotan 2", role: "Melanocortin agonist", doses: "10 mg" },
    ],
  },
  {
    id: "editorial-specialty-sleep",
    label: "Specialty & Sleep",
    intro:
      "Targeted solutions for immune modulation, sleep architecture, and specialized clinical needs.",
    peptides: [
      { name: "Thymosin α-1", role: "Immune modulator", doses: "5 mg" },
      { name: "DSIP", role: "Delta sleep peptide", doses: "5, 15 mg" },
    ],
  },
  {
    id: "editorial-metabolic",
    label: "Weight Management & Metabolic",
    intro:
      "Science-backed compounds targeting obesity, metabolic syndrome, and body composition through multiple pathways.",
    peptides: [
      { name: "Tirzepatide", role: "Dual GLP-1 / GIP agonist", doses: "5–60 mg" },
      { name: "GLP3-RT", role: "Triple incretin agonist", doses: "5–30 mg" },
      { name: "Cagrilintide", role: "Amylin analog", doses: "5, 10 mg" },
      { name: "AOD-9604", role: "Fat metabolism fragment", doses: "5 mg" },
      { name: "5-Amino-1MQ", role: "Oral NNMT inhibitor", doses: "50 mg cap" },
    ],
  },
];

const DESIGN_PRINCIPLES = [
  "Minimal form",
  "Muted mineral palette",
  "Tactile matte finishes",
  "Subtle identity integration",
  "Editorial composition",
  "Clinical credibility without clinical harshness",
];

const PROTOCOLS = [
  {
    label: "01 / Metabolic",
    name: "GLP Strong",
    desc: "The next generation of metabolic optimization. Formulated for measurable change and long-term adherence.",
    image: glpStrongImg,
  },
  {
    label: "02 / Longevity",
    name: "MOTS-C",
    desc: "Mitochondrial-derived peptide delivered through a precision auto-injector pen — engineered for the long arc of cellular renewal.",
    image: motscImg,
  },
  {
    label: "03 / Aesthetics",
    name: "GHK-Cu",
    desc: "A copper-binding tripeptide for skin architecture, presented in a vial designed with the same intent as the molecule itself.",
    image: ghkCuImg,
  },
];

const PARTNER_BENEFITS = [
  "Certified Partner status with the (mino) credential.",
  "Turnkey marketing and patient-education materials.",
  "Priority access to new protocols and clinical resources.",
  "Dedicated partnership and onboarding support.",
];

const STANDARD_PILLARS = [
  {
    label: "Sourced",
    title: "Sourced with rigor.",
    desc: "Pharmaceutical-grade inputs, fully traceable from manufacture to patient.",
  },
  {
    label: "Aligned",
    title: "Clinically aligned.",
    desc: "Protocols developed in conversation with practicing providers, not in isolation.",
  },
  {
    label: "Elevated",
    title: "Built to elevate.",
    desc: "Premium presentation, from packaging to patient experience — the brand patients can believe in.",
  },
];

export default function Home() {
  return (
    <main
      data-testid="home-main"
      className="bg-mino-cream text-mino-forest selection:bg-mino-forest selection:text-mino-cream"
    >
      {/* PAGE 1 — COVER (FULL-BLEED HERO) */}
      <section
        data-testid="section-hero"
        className="relative h-screen min-h-[640px] w-full overflow-hidden"
        style={{
          backgroundColor: "#1a2410",
          backgroundImage:
            "linear-gradient(180deg, #1f2c14 0%, #182210 55%, #0d1408 100%)",
        }}
      >
        {/* Atmospheric color field — layered radial washes for depth */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: [
              // Golden-hour top light (sun)
              "radial-gradient(ellipse 70% 45% at 50% 12%, rgba(232,180,108,0.42), transparent 62%)",
              // Warm clay glow over the wordmark area
              "radial-gradient(ellipse 55% 38% at 50% 48%, rgba(210,166,104,0.28), transparent 65%)",
              // Cool emerald midtone left
              "radial-gradient(ellipse 60% 80% at 8% 55%, rgba(60,92,52,0.45), transparent 70%)",
              // Cool emerald midtone right
              "radial-gradient(ellipse 60% 80% at 100% 60%, rgba(48,78,44,0.48), transparent 70%)",
              // Deep moss vignette at the bottom
              "radial-gradient(ellipse 100% 55% at 50% 110%, rgba(6,12,4,0.75), transparent 70%)",
              // Subtle top-edge shadow for nav contrast
              "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 18%)",
            ].join(", "),
          }}
        />

        {/* Soft luminous halo behind the wordmark */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[55vh] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(244,236,219,0.16), rgba(244,236,219,0.06) 35%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <FadeIn delay={0.15}>
            <div
              className="mino-eyebrow tracking-[0.4em] mb-10"
              style={{
                color: "#ffffff",
                fontWeight: 700,
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              Regenerative Medicine
            </div>
          </FadeIn>
          <FadeIn delay={0.3}>
            <h1
              className="font-serif text-[clamp(5rem,18vw,15rem)] leading-[0.9] tracking-[-0.02em]"
              style={{
                color: "#ffffff",
                fontWeight: 500,
                textShadow:
                  "0 1px 0 rgba(0,0,0,0.18), 0 0 60px rgba(255,255,255,0.22), 0 0 120px rgba(232,180,108,0.18)",
              }}
            >
              (mino)
            </h1>
          </FadeIn>
          <FadeIn delay={0.5}>
            <p
              className="mt-10 font-serif italic text-xl md:text-2xl max-w-xl"
              style={{
                color: "#ffffff",
                fontWeight: 500,
                textShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }}
            >
              Peptide Therapies for Cellular Renewal
            </p>
          </FadeIn>
          <FadeIn delay={0.7}>
            <div className="mt-16 flex flex-col items-center gap-3">
              <span
                className="mino-eyebrow text-[10px] tracking-[0.3em]"
                style={{
                  color: "#ffffff",
                  fontWeight: 700,
                  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                }}
              >
                Scroll
              </span>
              <span
                aria-hidden
                className="block w-px h-10"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)",
                }}
              />
            </div>
          </FadeIn>
        </div>

        {/* Editorial film grain — placed last so it textures the entire scene
            including the wordmark and copy, not just the background layers. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.22] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95 0 0 0 0 0.93 0 0 0 0 0.88 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </section>

      {/* TRUST BAR */}
      <section
        data-testid="section-trust"
        className="border-y border-mino-forest/15 bg-mino-bone/50"
      >
        <div className="max-w-[88rem] mx-auto px-6 md:px-12 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {TRUST_ITEMS.map((item, idx) => (
            <div
              key={item}
              className="flex items-center gap-3"
              data-testid={`trust-item-${idx}`}
            >
              <span className="mino-eyebrow text-mino-forest/90">{item}</span>
              {idx < TRUST_ITEMS.length - 1 && (
                <span className="text-mino-sage-deep hidden md:inline">·</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FIELD GUIDE
          Eight category spreads that anchor the nav dropdown. Each
          card lists the peptides in that category with role + dose
          callouts. */}
      <section
        data-testid="section-field-guide"
        className="px-6 md:px-12 py-20 md:py-28 overflow-hidden"
      >
        <div className="max-w-[88rem] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="flex items-center gap-3">
              <span className="mino-rule" />
              <span className="mino-eyebrow text-mino-sage-deep">
                Vol. I · Field Guide
              </span>
            </div>
            <p className="font-serif text-xl md:text-2xl text-mino-forest/90 leading-snug max-w-xl">
              Eight categories, one regenerative system — every compound
              prescription-only and clinically supervised.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-mino-forest/15 border border-mino-forest/15">
            {FIELD_GUIDE.map((entry, i) => (
              <article
                key={entry.id}
                id={entry.id}
                data-testid={`spread-${entry.id}`}
                className="bg-mino-cream p-8 md:p-10 flex flex-col gap-5 scroll-mt-24"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="mino-eyebrow text-mino-sage-deep">
                    {String(i + 1).padStart(2, "0")} · Field Guide
                  </span>
                  <span className="mino-eyebrow text-mino-sage-deep/70 text-[10px]">
                    {entry.peptides.length} compounds
                  </span>
                </div>
                <h3 className="font-serif text-3xl md:text-[2rem] text-mino-forest leading-[1.05]">
                  {entry.label}
                </h3>
                <p className="text-sm text-mino-forest/85 leading-relaxed">
                  {entry.intro}
                </p>
                <ul className="mt-2 flex flex-col divide-y divide-mino-forest/10 border-t border-mino-forest/15">
                  {entry.peptides.map((p) => (
                    <li key={p.name} className="py-3">
                      <div className="font-serif text-base text-mino-forest leading-tight">
                        {p.name}
                      </div>
                      <div className="text-xs text-mino-forest/60 leading-snug">
                        {p.role}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PAGE 2 — BRAND POSITIONING */}
      <section
        id="positioning"
        data-testid="section-positioning"
        className="py-28 md:py-44 px-6 md:px-12 bg-mino-bone/40"
      >
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-9">
            <FadeIn>
              <div className="flex items-center gap-3 mb-8">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Section 01 · Positioning
                </span>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight max-w-4xl">
                A More Refined Approach to{" "}
                <span className="italic text-mino-sage-deep">
                  Regenerative Medicine.
                </span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="mt-12 max-w-3xl space-y-6 text-lg md:text-xl text-mino-forest/90 leading-relaxed">
                <p>
                  Regenerative medicine has traditionally been presented
                  through a clinical lens — technical, sterile, and often
                  disconnected from the human experience.
                </p>
                <p>Mino reframes this category.</p>
                <p>
                  By combining advanced peptide therapies with a language of
                  restraint, material elegance, and visual clarity, Mino
                  creates a system that feels both credible and culturally
                  relevant.
                </p>
                <p className="font-serif italic text-mino-forest text-2xl md:text-3xl pt-4">
                  This is not medicine as interruption. This is medicine as
                  integration.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* PAGE 3 — DESIGN PHILOSOPHY */}
      <section
        id="philosophy"
        data-testid="section-philosophy"
        className="py-28 md:py-44 px-6 md:px-12 bg-mino-cream overflow-hidden"
      >
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-20 items-start">
          <div className="md:col-span-6">
            <FadeIn>
              <div className="flex items-center gap-3 mb-8">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Section 02 · Design Philosophy
                </span>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                Designed to{" "}
                <span className="italic text-mino-sage-deep">
                  Reduce Noise.
                </span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-8 font-serif italic text-2xl md:text-3xl text-mino-forest/85 leading-snug max-w-md">
                Clarity is the new signal in modern wellness.
              </p>
            </FadeIn>
          </div>

          <div className="md:col-span-5 md:col-start-8">
            <FadeIn delay={0.3}>
              <ul className="space-y-0">
                {DESIGN_PRINCIPLES.map((p, i) => (
                  <li
                    key={p}
                    data-testid={`principle-${i}`}
                    className="flex items-start gap-6 border-t border-mino-forest/15 py-5 last:border-b"
                  >
                    <span className="mino-eyebrow text-mino-sage-deep mt-1.5 shrink-0">
                      0{i + 1}
                    </span>
                    <span className="font-serif text-xl md:text-2xl text-mino-forest/85 leading-snug">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* EDITORIAL FULL-BLEED — visual breath between philosophy and system */}
      <section
        data-testid="section-editorial"
        className="relative h-[60vh] md:h-[80vh] w-full overflow-hidden bg-mino-forest"
      >
        <img
          src={quoteImg}
          alt="(mino) editorial pull quote"
          className="absolute inset-0 w-full h-full object-cover opacity-95"
        />
      </section>

      {/* PAGE 4 — REGENERATIVE SYSTEM */}
      <section
        id="protocols"
        data-testid="section-system"
        className="py-28 md:py-44 px-6 md:px-12 bg-mino-bone/40"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 md:mb-24">
              <div className="md:col-span-5">
                <div className="flex items-center gap-3 mb-8">
                  <span className="mino-rule" />
                  <span className="mino-eyebrow text-mino-sage-deep">
                    Section 03 · The System
                  </span>
                </div>
                <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                  A Cohesive{" "}
                  <span className="italic text-mino-sage-deep">
                    Regenerative System.
                  </span>
                </h2>
              </div>
              <div className="md:col-span-7">
                <p className="font-serif italic text-2xl md:text-3xl text-mino-forest/85 leading-snug mb-8">
                  Delivery, formulation, and presentation — aligned.
                </p>
                <p className="text-lg text-mino-forest/90 leading-relaxed">
                  Mino is designed as a complete regenerative platform,
                  integrating peptide formulations, delivery systems, and
                  visual presentation into one unified experience. Each element
                  reinforces the next — creating clarity for providers and
                  confidence for patients.
                </p>
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-mino-forest/15 border border-mino-forest/15">
            {PROTOCOLS.map((p, i) => (
              <FadeIn key={p.name} delay={i * 0.1}>
                <article
                  data-testid={`protocol-${p.name.toLowerCase()}`}
                  className="bg-mino-cream p-8 md:p-10 h-full flex flex-col"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden bg-mino-bone mb-8">
                    <img
                      src={p.image}
                      alt={`${p.name} protocol`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="mino-eyebrow text-mino-sage-deep">
                    {p.label}
                  </span>
                  <h3 className="font-serif text-3xl md:text-4xl mt-3 text-mino-forest tracking-tight">
                    {p.name}
                  </h3>
                  <p className="mt-5 text-mino-forest/88 leading-relaxed flex-1">
                    {p.desc}
                  </p>
                </article>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2}>
            <div className="mt-12 flex justify-center md:justify-end">
              <Link
                href="/catalog"
                data-testid="button-protocols-cta"
                className="inline-flex items-center gap-3 mino-eyebrow text-mino-forest hover:text-mino-sage-deep transition-colors"
              >
                Browse the full catalog
                <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* SECTION 04 — FOR PARTNERS */}
      <section
        id="partners"
        data-testid="section-partners"
        className="py-28 md:py-40 px-6 md:px-12"
      >
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <FadeIn direction="right">
              <article
                data-testid="case-note-paper"
                className="bg-white text-mino-forest border border-mino-forest/15 shadow-[0_30px_80px_-40px_rgba(20,28,18,0.35)] p-6 md:p-10 lg:p-12 font-serif"
              >
                {/* HEADER STRIP */}
                <header className="border border-mino-forest/20 px-5 py-3 flex items-center justify-between gap-4 mb-10">
                  <span className="font-serif text-xl tracking-tight">
                    (mino)
                  </span>
                  <div className="mino-eyebrow text-[10px] text-mino-forest/85 text-right leading-relaxed tracking-[0.18em]">
                    Case Note · No. 06
                    <br className="hidden sm:inline" />
                    <span className="hidden sm:inline">
                      Spring · 2026 · Mino Clinic
                    </span>
                  </div>
                </header>

                {/* HERO ROW */}
                <div className="pb-10 border-b border-mino-forest/15">
                  <h3 className="font-serif text-3xl md:text-[2.6rem] leading-[1.05] tracking-tight max-w-2xl">
                    A quiet kind of{" "}
                    <span className="italic">clinical</span> attention.
                  </h3>
                </div>

                {/* THREE PROTOCOL COLUMNS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 py-10 border-b border-mino-forest/15">
                  {[
                    {
                      label: "Metabolic",
                      n: "01",
                      headline: "Weight,",
                      headlineItalic: "reframed.",
                      body: "For patients seeking a sustainable protocol — not a quick loss, but a body that recalibrates over months.",
                      items: [
                        ["GLP-1 RT", "10 / 30"],
                        ["Tesamorelin", "10 / 30"],
                        ["5-Amino-1MQ", "Custom"],
                      ],
                    },
                    {
                      label: "Recovery",
                      n: "02",
                      headline: "Tissue,",
                      headlineItalic: "repaired.",
                      body: "Post-surgical, injury, or overuse. Layered peptides to support soft-tissue healing and inflammation.",
                      items: [
                        ["BPC-157", "60"],
                        ["TB-500", "60"],
                        ["KPV", "60"],
                      ],
                    },
                    {
                      label: "Longevity",
                      n: "03",
                      headline: "Cells,",
                      headlineItalic: "tended.",
                      body: "The long game. Mitochondrial, telomeric, and cellular-energy work for patients planning decades ahead.",
                      items: [
                        ["NAD+", "1000"],
                        ["MOTS-c", "60"],
                        ["Epithalon", "60"],
                      ],
                    },
                  ].map((col) => (
                    <div key={col.label} className="flex flex-col">
                      <div className="flex items-center justify-between border-b border-mino-forest/20 pb-2 mb-4">
                        <span className="mino-eyebrow text-[10px] text-mino-sage-deep tracking-[0.22em]">
                          {col.label}
                        </span>
                        <span className="mino-eyebrow text-[10px] text-mino-forest/50">
                          {col.n}
                        </span>
                      </div>
                      <h4 className="font-serif text-xl md:text-2xl leading-tight">
                        {col.headline}{" "}
                        <span className="italic">{col.headlineItalic}</span>
                      </h4>
                      <p className="mt-3 text-xs md:text-sm text-mino-forest/88 leading-relaxed font-sans">
                        {col.body}
                      </p>
                      <ul className="mt-5 space-y-1.5">
                        {col.items.map(([name, dose]) => (
                          <li
                            key={name}
                            className="flex items-baseline justify-between gap-3 border-t border-mino-forest/10 pt-1.5 mino-eyebrow text-[10px] tracking-[0.18em] text-mino-forest/90"
                          >
                            <span>{name}</span>
                            <span className="text-mino-forest/55">{dose}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* PULL QUOTE */}
                <div className="py-10 border-b border-mino-forest/15">
                  <blockquote className="font-serif italic text-lg md:text-xl text-mino-forest/85 leading-snug max-w-2xl">
                    &ldquo;We don&rsquo;t chase trends. We chase evidence,
                    carefully dosed, and we sit with our patients long enough to
                    see it work.&rdquo;
                  </blockquote>
                  <p className="mino-eyebrow text-[10px] text-mino-forest/55 mt-4 tracking-[0.22em]">
                    Interview · Closed Channel · Cases 06
                  </p>
                </div>

                {/* FOOTER ROW */}
                <footer className="pt-6 flex justify-end">
                  <p className="font-serif italic text-mino-sage-deep text-sm">
                    Request a consultation —
                  </p>
                </footer>
              </article>
            </FadeIn>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2">
            <FadeIn>
              <div className="flex items-center gap-3 mb-6">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Section 04 · For Partners &amp; Clinicians
                </span>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="font-serif text-4xl md:text-5xl leading-[1.1] tracking-tight">
                Your practice, powered by a brand patients{" "}
                <span className="italic text-mino-sage-deep">trust.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-8 text-lg text-mino-forest/90 leading-relaxed">
                <span className="font-serif text-mino-forest">
                  <span className="text-mino-sage-deep">(</span>mino
                  <span className="text-mino-sage-deep">)</span>
                </span>{" "}
                is more than a supplier. We're a B2B platform built for clinics,
                providers, and wellness brands that refuse to compromise on
                quality or presentation. Become a certified partner and gain
                access to vetted protocols, co-branded marketing collateral, and
                a credentialing program that signals the standard you set.
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <ul className="mt-10 space-y-4">
                {PARTNER_BENEFITS.map((b, i) => (
                  <li
                    key={b}
                    data-testid={`partner-benefit-${i}`}
                    className="flex items-start gap-4 border-t border-mino-forest/15 pt-4"
                  >
                    <span className="mino-eyebrow text-mino-sage-deep mt-1 shrink-0">
                      0{i + 1}
                    </span>
                    <span className="text-mino-forest/85 leading-relaxed">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn delay={0.4}>
              <a
                href="#waitlist"
                data-testid="button-partners-cta"
                className="mt-10 inline-flex items-center justify-center mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-8 py-4"
              >
                Apply for Partnership
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SECTION 05 — FOR PATIENTS */}
      <section
        id="patients"
        data-testid="section-patients"
        className="relative py-28 md:py-40 px-6 md:px-12 text-mino-cream overflow-hidden"
        style={{
          backgroundColor: "#1a2410",
          backgroundImage:
            "linear-gradient(180deg, #1f2c14 0%, #0f1808 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.28]">
          <img
            src={hairImg}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
          />
        </div>
        {/* Layered atmospheric gradient — emerald left, warm clay right, deep moss vignette */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 70% 90% at 0% 50%, rgba(20,32,12,0.92), rgba(20,32,12,0.55) 45%, transparent 75%)",
              "radial-gradient(ellipse 55% 70% at 100% 50%, rgba(210,166,104,0.22), transparent 60%)",
              "radial-gradient(ellipse 90% 60% at 50% 100%, rgba(6,12,4,0.65), transparent 70%)",
              "linear-gradient(90deg, rgba(15,24,8,0.85) 0%, rgba(20,32,12,0.55) 45%, transparent 80%)",
            ].join(", "),
          }}
        />
        {/* Editorial film grain to match hero */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95 0 0 0 0 0.93 0 0 0 0 0.88 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <div className="relative max-w-[88rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <FadeIn>
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="mino-rule"
                  style={{ backgroundColor: "#ffffff" }}
                />
                <span
                  className="mino-eyebrow"
                  style={{
                    color: "#ffffff",
                    fontWeight: 700,
                    textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                  }}
                >
                  Section 05 · For the people you serve
                </span>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2
                className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight"
                style={{
                  color: "#ffffff",
                  fontWeight: 500,
                  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                }}
              >
                Outcomes patients can feel.
                <br />
                <span
                  className="italic"
                  style={{ color: "#ffffff", fontWeight: 500 }}
                >
                  A brand they can believe in.
                </span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-8 text-lg text-mino-cream/80 leading-relaxed max-w-2xl">
                Whether you're seeking better metabolic health, sharper
                recovery, or a more deliberate approach to longevity,{" "}
                <span className="font-serif text-mino-cream">
                  <span className="text-mino-sage">(</span>mino
                  <span className="text-mino-sage">)</span>
                </span>{" "}
                protocols are delivered through a network of certified
                providers — so the experience matches the outcome.
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <a
                href="#waitlist"
                data-testid="button-patients-cta"
                className="mt-10 inline-flex items-center justify-center mino-eyebrow text-mino-forest bg-mino-cream hover:bg-mino-bone transition-colors px-8 py-4"
              >
                Inquire for Peptide Consultation with Mino MD
              </a>
            </FadeIn>
          </div>

          <div className="lg:col-span-5 hidden lg:block">
            <FadeIn direction="left" delay={0.2}>
              <div className="aspect-[3/4] overflow-hidden border border-mino-cream/20">
                <img
                  src={productImg}
                  alt="(mino) product detail"
                  className="w-full h-full object-cover"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SECTION 06 — THE STANDARD */}
      <section
        id="standard"
        data-testid="section-standard"
        className="py-28 md:py-40 px-6 md:px-12"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Section 06 · The (mino) Standard
                </span>
                <span className="mino-rule" />
              </div>
              <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                Certified.
                <span className="italic text-mino-sage-deep"> Credentialed.</span>{" "}
                Uncompromising.
              </h2>
              <p className="mt-8 text-lg text-mino-forest/88 leading-relaxed">
                Every product, partner, and protocol carries the{" "}
                <span className="font-serif text-mino-forest">
                  <span className="text-mino-sage-deep">(</span>mino
                  <span className="text-mino-sage-deep">)</span>
                </span>{" "}
                mark — a certification built on sourcing transparency, clinical
                alignment, and brand integrity. When you see it, you know what
                it stands for.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-mino-forest/15 border border-mino-forest/15">
            {STANDARD_PILLARS.map((pillar, i) => (
              <FadeIn key={pillar.label} delay={i * 0.1}>
                <div
                  data-testid={`pillar-${pillar.label.toLowerCase()}`}
                  className="bg-mino-cream p-10 md:p-12 h-full flex flex-col"
                >
                  <span className="font-serif text-7xl text-mino-sage-deep/40 leading-none">
                    0{i + 1}
                  </span>
                  <span className="mino-eyebrow text-mino-sage-deep mt-6">
                    {pillar.label}
                  </span>
                  <h3 className="font-serif text-2xl md:text-3xl mt-3 leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="mt-5 text-mino-forest/88 leading-relaxed flex-1">
                    {pillar.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 07 — WAITLIST */}
      <section
        id="waitlist"
        data-testid="section-waitlist"
        className="py-28 md:py-40 px-6 md:px-12 bg-mino-bone/60 border-t border-mino-forest/15"
      >
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12 md:mb-16">
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Section 07 · Access
                </span>
                <span className="mino-rule" />
              </div>
              <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                Access to{" "}
                <span className="font-serif">
                  <span className="text-mino-sage-deep">(</span>
                  <span className="italic">mino</span>
                  <span className="text-mino-sage-deep">)</span>
                </span>
                .
              </h2>
              <p className="mt-6 text-lg text-mino-forest/88 leading-relaxed max-w-2xl mx-auto">
                To gain access, share a few details below and we'll follow up
                with a quiet, considered note and your next steps.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <WaitlistForm />
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
