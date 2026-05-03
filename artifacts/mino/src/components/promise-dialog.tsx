import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const COMMITMENT_PARAGRAPHS: string[] = [
  "Medicine is changing. The patients have arrived with names on their phones, with questions you were not trained to answer, with stories about friends and websites and providers operating somewhere in the gray. The category has outpaced the institutions that were meant to hold it.",
  "Mino exists for the physicians who have decided the answer to that cannot be silence \u2014 who have chosen to bring this medicine into practice properly, on the standard of care they would extend to their own family.",
  "We are the wholesale infrastructure for that choice. Pharmaceutical-grade compounds, sourced from cGMP-compliant manufacturers, third-party verified, dispensed only to licensed clinicians and their compounding partners. We do not serve the consumer market. We exist to give serious clinicians a supply chain worthy of the medicine they practice.",
  "The standard a physician would apply to her own family is the only standard that has ever mattered. It is the one Mino is built to meet.",
];

const PRACTITIONER_PARAGRAPH =
  "Mino was founded by an operator and a physician who looked at the peptide supply landscape and concluded that no one was building what serious medicine actually required. Our accounts range from solo physician practices to enterprise networks operating across dozens of locations. Every relationship begins with credentialing and continues with dedicated account management, clinical reference materials, and predictable supply \u2014 because the practice you have spent your career building deserves a supplier that takes its work as seriously as you take yours.";

type Pillar = { title: string; body: string };

const PILLARS: Pillar[] = [
  {
    title: "Sourcing Integrity",
    body: "Direct relationships with cGMP-compliant manufacturers. No grey-market intermediaries, no repackaged research chemicals \u2014 the supply chain you would build yourself.",
  },
  {
    title: "Clinical Documentation",
    body: "A Certificate of Analysis, storage protocol, and clinical reference with every shipment. The defensible answer to every question your patient \u2014 or your malpractice carrier \u2014 will ask.",
  },
  {
    title: "Regulatory Honesty",
    body: "FDA-approved, investigational, and research-only compounds labeled exactly as they are. We do not blur the lines that protect your license.",
  },
  {
    title: "Cold-Chain Logistics",
    body: "Temperature-controlled fulfillment, tracked delivery, pharmaceutical packaging. The vial that arrives at your clinic is the vial that left the facility.",
  },
  {
    title: "Account Partnership",
    body: "Dedicated sales and clinical support, answerable to you. We work with your practice, not at it \u2014 and we return your call the same day.",
  },
];

const CLOSING =
  "Mino exists for the practitioners writing the next chapter of medicine. We supply the infrastructure. The clinical relationship is yours.";

type PromiseDialogProps = {
  trigger: ReactNode;
};

export function PromiseDialog({ trigger }: PromiseDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0 sm:rounded-none"
        data-testid="promise-dialog"
      >
        <div className="overflow-y-auto max-h-[88vh] p-8 md:p-12">
          {/* Masthead */}
          <div className="border-b border-mino-forest/15 pb-8 mb-10">
            <span className="mino-eyebrow text-mino-sage-deep">
              The Promise
            </span>
            <h3 className="font-serif text-4xl md:text-5xl mt-3 leading-[1.05]">
              The pharmacy modern medicine
              <br />
              has been waiting for.
            </h3>
            <p className="mt-5 text-mino-forest/85 italic font-serif text-lg md:text-xl leading-snug">
              A wholesale peptide platform for the physicians shaping the next
              chapter of medicine.
            </p>
          </div>

          {/* The Mino Commitment */}
          <section className="mb-12">
            <span className="mino-eyebrow text-mino-sage-deep block mb-4">
              The (mino) Commitment
            </span>
            <div className="space-y-5">
              {COMMITMENT_PARAGRAPHS.map((paragraph, index) => (
                <p
                  key={index}
                  className={
                    index === 0
                      ? "font-serif text-lg md:text-xl text-mino-forest leading-snug"
                      : "text-[15px] text-mino-forest/85 leading-relaxed"
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          {/* Built for the Practitioner */}
          <section className="mb-12 pt-8 border-t border-mino-forest/15">
            <span className="mino-eyebrow text-mino-sage-deep block mb-4">
              Built for the Practitioner
            </span>
            <p className="text-[15px] text-mino-forest/85 leading-relaxed">
              {PRACTITIONER_PARAGRAPH}
            </p>
          </section>

          {/* Why Mino — The Five Pillars */}
          <section className="pt-8 border-t border-mino-forest/15">
            <span className="mino-eyebrow text-mino-sage-deep block">
              Why (mino)
            </span>
            <h4 className="font-serif text-2xl md:text-3xl mt-2 mb-8 leading-tight">
              The Five Pillars.
            </h4>
            <ol className="space-y-7">
              {PILLARS.map((pillar, index) => (
                <li
                  key={pillar.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 md:gap-6"
                >
                  <span className="mino-eyebrow text-mino-sage-deep pt-1">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h5 className="font-serif text-xl md:text-2xl text-mino-forest leading-tight">
                      {pillar.title}.
                    </h5>
                    <p className="mt-2 text-[15px] text-mino-forest/85 leading-relaxed">
                      {pillar.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Closing */}
          <div className="mt-12 pt-8 border-t border-mino-forest/15">
            <p className="font-serif italic text-lg md:text-xl text-mino-forest leading-snug">
              {CLOSING}
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-mino-forest/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-mino-forest/55 italic font-serif">
              A pharmacy of peptides for the practice of medicine.
            </p>
            <button
              type="button"
              data-testid="button-promise-close"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-8 py-4 self-start sm:self-auto"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
