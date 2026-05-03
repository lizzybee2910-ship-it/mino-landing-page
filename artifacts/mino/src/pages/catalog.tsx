import { useEffect } from "react";
import { motion } from "framer-motion";
import { homeHashHref } from "@/lib/links";
import {
  CATEGORIES,
  CREDENTIALING,
  FOUNDERS_LETTER,
  PRICING_TIERS,
  REGULATORY_FRAMEWORK,
  TOTAL_CATEGORIES,
  TOTAL_COMPOUNDS,
  TOTAL_TIERS,
  type Category,
  type Compound,
} from "@/data/catalog";

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function CompoundRow({ compound }: { compound: Compound }) {
  const hasNarrative = Boolean(compound.description);

  return (
    <div
      data-testid={`compound-${compound.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className="grid grid-cols-12 gap-4 md:gap-6 py-7 border-t border-mino-forest/10 first:border-t-0"
    >
      <div className="col-span-12 md:col-span-4">
        {compound.image && (
          <div
            data-testid={`compound-image-${compound.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className="mb-4 overflow-hidden bg-mino-forest/5 border border-mino-forest/10"
          >
            <img
              src={compound.image}
              alt={`${compound.name} product photograph`}
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        )}
        <h4 className="font-serif text-2xl md:text-[1.65rem] text-mino-forest leading-tight">
          {compound.name}
        </h4>
        <p className="mt-1 mino-eyebrow text-mino-forest/55 text-[0.7rem]">
          {compound.form}
        </p>
      </div>

      <div className="col-span-12 md:col-span-8">
        <p className="text-[0.95rem] text-mino-forest/85 leading-relaxed">
          {compound.use}
        </p>
        {hasNarrative && (
          <p className="mt-3 text-[0.95rem] text-mino-forest/85 leading-relaxed font-serif italic">
            {compound.description}
          </p>
        )}
        {compound.idealFor && (
          <p className="mt-3 text-xs text-mino-forest/60">
            <span className="mino-eyebrow text-mino-sage-deep">
              Ideal for ·{" "}
            </span>
            {compound.idealFor}
          </p>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: Category }) {
  return (
    <section
      id={category.slug}
      data-testid={`category-${category.slug}`}
      className="py-24 md:py-32 px-6 md:px-12 border-t border-mino-forest/10"
    >
      <div className="max-w-[88rem] mx-auto">
        <FadeIn>
          <div className="grid grid-cols-12 gap-6 mb-12 items-baseline">
            <div className="col-span-12 md:col-span-2">
              <span className="font-serif text-6xl md:text-7xl text-mino-sage-deep leading-none">
                {category.numeral}
              </span>
            </div>
            <div className="col-span-12 md:col-span-10">
              <span className="mino-eyebrow text-mino-sage-deep">
                Category {category.number}
              </span>
              <h3 className="font-serif text-4xl md:text-6xl text-mino-forest mt-3 leading-[1.05]">
                {category.title}
              </h3>
              <p className="mt-5 max-w-3xl font-serif italic text-xl md:text-2xl text-mino-forest/85 leading-snug">
                {category.tagline}
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-14">
            <div className="col-span-12 md:col-span-7">
              <span className="mino-eyebrow text-mino-forest/50">
                Category overview
              </span>
              <p className="mt-4 text-mino-forest/90 leading-relaxed text-[1.02rem]">
                {category.overview}
              </p>
            </div>
            <div className="col-span-12 md:col-span-5 space-y-7">
              <div>
                <span className="mino-eyebrow text-mino-forest/50">
                  Typical applications
                </span>
                <p className="mt-3 text-sm text-mino-forest/88 leading-relaxed">
                  {category.applications}
                </p>
              </div>
              <div>
                <span className="mino-eyebrow text-mino-forest/50">
                  {category.practiceNote.label}
                </span>
                <p className="mt-3 text-sm text-mino-forest/88 leading-relaxed">
                  {category.practiceNote.body}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-mino-cream border border-mino-forest/15 px-6 md:px-10 py-2">
            <div className="hidden md:grid grid-cols-12 gap-6 py-4 border-b border-mino-forest/15">
              <span className="col-span-4 mino-eyebrow text-mino-forest/55">
                Compound
              </span>
              <span className="col-span-8 mino-eyebrow text-mino-forest/55">
                Primary clinical use
              </span>
            </div>
            {category.compounds.map((compound) => (
              <CompoundRow key={compound.name} compound={compound} />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

export default function Catalog() {
  useEffect(() => {
    document.title = "(mino) — Wholesale Catalog · Volume I";
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="bg-mino-cream text-mino-forest pt-32 md:pt-40 pb-24 min-h-screen">
      {/* MASTHEAD */}
      <header
        data-testid="catalog-masthead"
        className="px-6 md:px-12 mb-24 md:mb-36"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <span className="mino-rule" />
              <span className="mino-eyebrow text-mino-sage-deep">
                Wholesale Catalog · Volume I · Edition 2026
              </span>
            </div>
          </FadeIn>

          <div className="grid grid-cols-12 gap-6 md:gap-12 items-end">
            <div className="col-span-12 md:col-span-8">
              <FadeIn delay={0.05}>
                <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1] tracking-tight">
                  The complete{" "}
                  <span className="italic text-mino-sage-deep">portfolio.</span>
                </h1>
              </FadeIn>
              <FadeIn delay={0.15}>
                <p className="mt-8 max-w-2xl text-lg text-mino-forest/88 leading-relaxed">
                  Thirty-five pharmaceutical-grade peptide compounds —
                  &ge;99% purity, HPLC and MS verified — organized across
                  nine therapeutic categories and supplied exclusively to
                  licensed clinical practices.
                </p>
              </FadeIn>
            </div>
            <div className="col-span-12 md:col-span-4">
              <FadeIn delay={0.2}>
                <div
                  data-testid="catalog-stats"
                  className="grid grid-cols-3 border-t border-mino-forest/20 pt-8"
                >
                  <div>
                    <div className="font-serif text-4xl md:text-5xl">
                      {TOTAL_COMPOUNDS}
                    </div>
                    <div className="mino-eyebrow text-mino-forest/55 mt-2">
                      Compounds
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-4xl md:text-5xl">
                      {TOTAL_CATEGORIES}
                    </div>
                    <div className="mino-eyebrow text-mino-forest/55 mt-2">
                      Categories
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-4xl md:text-5xl">
                      {TOTAL_TIERS}
                    </div>
                    <div className="mino-eyebrow text-mino-forest/55 mt-2">
                      Tiers
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </header>

      {/* CATEGORY OVERVIEW GRID */}
      <section
        data-testid="catalog-overview"
        className="px-6 md:px-12 mb-12"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="flex items-center gap-3 mb-10">
              <span className="mino-rule" />
              <span className="mino-eyebrow text-mino-sage-deep">
                Nine Therapeutic Categories
              </span>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {CATEGORIES.map((cat, i) => (
              <FadeIn key={cat.slug} delay={i * 0.04}>
                <a
                  href={`#${cat.slug}`}
                  data-testid={`overview-card-${cat.slug}`}
                  className="block group bg-mino-cream border border-mino-forest/15 hover:border-mino-forest/40 transition-colors p-7 md:p-9 h-full"
                >
                  <div className="flex items-baseline justify-between mb-6">
                    <span className="font-serif text-3xl text-mino-sage-deep">
                      {cat.numeral}
                    </span>
                    <span className="mino-eyebrow text-mino-forest/45 text-[0.65rem]">
                      {cat.compounds.length} compounds
                    </span>
                  </div>
                  <h4 className="font-serif text-3xl text-mino-forest leading-tight">
                    {cat.title}
                  </h4>
                  <p className="mt-3 text-sm text-mino-forest/65 leading-relaxed line-clamp-3">
                    {cat.tagline}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 mino-eyebrow text-mino-forest group-hover:text-mino-sage-deep transition-colors">
                    View compounds
                    <span aria-hidden>→</span>
                  </span>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      {CATEGORIES.map((cat) => (
        <CategorySection key={cat.slug} category={cat} />
      ))}

      {/* THE ACCOUNT — FOUNDERS LETTER */}
      <section
        id="founders"
        data-testid="section-founders"
        className="py-28 md:py-40 px-6 md:px-12 bg-mino-bone border-t border-mino-forest/10"
      >
        <div className="max-w-[72rem] mx-auto">
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <span className="mino-rule" />
              <span className="mino-eyebrow text-mino-sage-deep">
                {FOUNDERS_LETTER.eyebrow}
              </span>
            </div>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight max-w-4xl">
              {FOUNDERS_LETTER.headline}
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 max-w-4xl">
              {FOUNDERS_LETTER.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-mino-forest/90 leading-relaxed text-[1.02rem]"
                >
                  {p}
                </p>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.25}>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-10 max-w-3xl border-t border-mino-forest/15 pt-10">
              {FOUNDERS_LETTER.signatures.map((s) => (
                <div key={s.name}>
                  <div className="font-serif italic text-2xl text-mino-forest">
                    {s.name}
                  </div>
                  <div className="mino-eyebrow text-mino-forest/55 mt-2 text-[0.7rem]">
                    {s.title}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* PRICING TIERS */}
      <section
        id="pricing"
        data-testid="section-pricing"
        className="py-28 md:py-36 px-6 md:px-12"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="grid grid-cols-12 gap-6 mb-14 items-end">
              <div className="col-span-12 md:col-span-7">
                <div className="flex items-center gap-3 mb-6">
                  <span className="mino-rule" />
                  <span className="mino-eyebrow text-mino-sage-deep">
                    The Account · Section I
                  </span>
                </div>
                <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                  Wholesale pricing structure
                </h2>
              </div>
              <div className="col-span-12 md:col-span-5">
                <p className="text-mino-forest/88 leading-relaxed">
                  Mino operates a three-tier wholesale pricing model. Tier
                  assignment is based on trailing six-month order volume and is
                  reviewed quarterly. New accounts begin at Tier I and may
                  advance based on performance.
                </p>
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier, i) => (
              <FadeIn key={tier.name} delay={i * 0.06}>
                <div
                  data-testid={`tier-${tier.name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="border border-mino-forest/20 bg-mino-cream p-8 md:p-10 h-full flex flex-col"
                >
                  <span className="mino-eyebrow text-mino-sage-deep">
                    {tier.name}
                  </span>
                  <h3 className="mt-4 font-serif text-3xl md:text-4xl text-mino-forest leading-tight">
                    {tier.audience}
                  </h3>
                  <p className="mt-6 text-sm text-mino-forest/88 leading-relaxed flex-1">
                    {tier.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2}>
            <p className="mt-10 max-w-3xl text-xs text-mino-forest/60 italic font-serif text-base">
              Compound-level pricing is provided on the confidential wholesale
              price list available to credentialed accounts. Catalog pricing is
              not published in public-facing materials and is subject to lot and
              supply chain conditions.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* CREDENTIALING & ORDERING */}
      <section
        id="credentialing"
        data-testid="section-credentialing"
        className="py-28 md:py-36 px-6 md:px-12 bg-mino-bone border-t border-b border-mino-forest/10"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="flex items-center gap-3 mb-6">
              <span className="mino-rule" />
              <span className="mino-eyebrow text-mino-sage-deep">
                The Account · Section II
              </span>
            </div>
            <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
              Credentialing & ordering
            </h2>
          </FadeIn>

          <div className="mt-14 grid grid-cols-12 gap-8 md:gap-12">
            <div className="col-span-12 md:col-span-7 space-y-10">
              <FadeIn delay={0.05}>
                <div>
                  <span className="mino-eyebrow text-mino-forest/55">
                    The credentialing process
                  </span>
                  <p className="mt-4 text-mino-forest/90 leading-relaxed text-[1.02rem]">
                    {CREDENTIALING.process}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.12}>
                <div>
                  <span className="mino-eyebrow text-mino-forest/55">
                    Typical turnaround
                  </span>
                  <p className="mt-4 text-mino-forest/90 leading-relaxed">
                    {CREDENTIALING.turnaround}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.18}>
                <div>
                  <span className="mino-eyebrow text-mino-forest/55">
                    Ordering channels
                  </span>
                  <p className="mt-4 text-mino-forest/90 leading-relaxed">
                    {CREDENTIALING.ordering}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.24}>
                <div>
                  <span className="mino-eyebrow text-mino-forest/55">
                    Fulfillment
                  </span>
                  <p className="mt-4 text-mino-forest/90 leading-relaxed">
                    {CREDENTIALING.fulfillment}
                  </p>
                </div>
              </FadeIn>
            </div>

            <div className="col-span-12 md:col-span-5">
              <FadeIn delay={0.1}>
                <div className="bg-mino-cream border border-mino-forest/20 p-8 md:p-10 sticky top-32">
                  <span className="mino-eyebrow text-mino-sage-deep">
                    Account management
                  </span>
                  <ul className="mt-8 space-y-7">
                    {CREDENTIALING.contacts.map((c) => (
                      <li
                        key={c.email}
                        data-testid={`contact-${c.email.split("@")[0]}`}
                      >
                        <div className="font-serif text-2xl text-mino-forest leading-tight">
                          {c.name}
                        </div>
                        {c.role && (
                          <div className="mino-eyebrow text-mino-forest/50 mt-1 text-[0.7rem]">
                            {c.role}
                          </div>
                        )}
                        <a
                          href={`mailto:${c.email}`}
                          data-testid={`mailto-${c.email.split("@")[0]}`}
                          className="mt-2 inline-block text-mino-forest/90 hover:text-mino-sage-deep transition-colors text-sm"
                        >
                          {c.email}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* REGULATORY & COMPLIANCE FRAMEWORK */}
      <section
        id="regulatory"
        data-testid="section-regulatory"
        className="py-28 md:py-36 px-6 md:px-12"
      >
        <div className="max-w-[88rem] mx-auto">
          <FadeIn>
            <div className="grid grid-cols-12 gap-6 mb-14 items-end">
              <div className="col-span-12 md:col-span-7">
                <div className="flex items-center gap-3 mb-6">
                  <span className="mino-rule" />
                  <span className="mino-eyebrow text-mino-sage-deep">
                    The Account · Section III
                  </span>
                </div>
                <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                  Regulatory & compliance framework
                </h2>
              </div>
              <div className="col-span-12 md:col-span-5">
                <p className="font-serif italic text-xl md:text-2xl text-mino-forest/85 leading-snug">
                  The peptide category exists within a complex and rapidly
                  evolving regulatory landscape. Mino's operating philosophy is
                  that honesty about that landscape is a competitive advantage,
                  not a burden.
                </p>
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12 max-w-6xl">
            {REGULATORY_FRAMEWORK.map((sec, i) => (
              <FadeIn key={sec.label} delay={i * 0.05}>
                <div className="border-t border-mino-forest/20 pt-6">
                  <span className="mino-eyebrow text-mino-sage-deep">
                    {sec.label}
                  </span>
                  <p className="mt-4 text-mino-forest/90 leading-relaxed">
                    {sec.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — REQUEST ACCESS */}
      <section
        data-testid="catalog-waitlist-cta"
        className="py-24 md:py-32 px-6 md:px-12 bg-mino-forest text-mino-cream"
      >
        <div className="max-w-[88rem] mx-auto grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-8">
            <span className="mino-eyebrow text-mino-sage">
              Ready to open an account?
            </span>
            <h2 className="mt-5 font-serif text-4xl md:text-6xl leading-[1.05]">
              Request access for credentialing.
            </h2>
            <p className="mt-6 max-w-2xl text-mino-cream/80 leading-relaxed">
              We're onboarding licensed practices in measured cohorts. Send your
              details and we'll follow up with a quiet, considered note and your
              next steps.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 md:text-right">
            <a
              href={homeHashHref("waitlist")}
              data-testid="link-catalog-to-waitlist"
              className="inline-flex items-center justify-center mino-eyebrow text-mino-forest bg-mino-cream hover:bg-mino-bone transition-colors px-8 py-4"
            >
              Request access →
            </a>
          </div>
        </div>
      </section>

      {/* CONFIDENTIALITY DISCLAIMER */}
      <footer
        data-testid="catalog-disclaimer"
        className="px-6 md:px-12 pt-16"
      >
        <div className="max-w-[72rem] mx-auto border-t border-mino-forest/15 pt-10 text-xs md:text-sm text-mino-forest/55 leading-relaxed font-serif italic">
          <p>
            This catalog is intended for licensed clinical professionals and is
            not a recommendation for any specific patient use. Nothing in this
            document constitutes medical advice or a guarantee of clinical
            outcomes. Regulatory status is current as of the edition date and is
            subject to change.
          </p>
          <p className="mt-4 mino-eyebrow text-mino-forest/40 not-italic">
            Edition 2026 · First Quarter ·{" "}
            <a
              href="mailto:hello@mino.life"
              className="hover:text-mino-sage-deep transition-colors"
            >
              hello@mino.life
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
