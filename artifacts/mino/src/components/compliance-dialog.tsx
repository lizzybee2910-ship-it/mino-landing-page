import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const PARAGRAPHS: string[] = [
  "Mino is a wholesale supply platform serving credentialed clinical practices in the United States. We do not sell to individuals, do not operate a consumer storefront, and do not establish or maintain a doctor-patient relationship with any end recipient.",
  "Every account is verified prior to dispensing. State medical, osteopathic, or advanced practice licensure is confirmed; DEA registration is confirmed where applicable; supervising physician relationships and standing protocols are reviewed by the medical director. Credentialing is a continuing requirement, not a one-time event.",
  "Every compound on the Mino formulary is sourced through a state-licensed 503A pharmacy or FDA-registered 503B outsourcing facility, with documented chain of custody and pharmaceutical-grade active pharmaceutical ingredient. Mino does not source from research-chemical suppliers, nutraceutical brokers, or unregulated international markets. Every dispense requires a valid prescription written by a licensed practitioner for an individually identified patient, in compliance with applicable federal and state law. Availability is subject to state law and may be limited or unavailable in certain jurisdictions.",
  "The Mino formulary is reviewed quarterly by the Chief Medical Officer. Compounds are added when the clinical evidence supports inclusion and removed when it does not.",
  "Compounded preparations are not approved by the United States Food and Drug Administration. Statements made on this site have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease. Information on this site is intended for licensed healthcare practitioners only and does not constitute medical advice. The treating practitioner is solely responsible for any clinical decision to prescribe, including the decision to prescribe off-label, and assumes full responsibility for patient selection, dosing, monitoring, and follow-up. Mino makes no representation or warranty that any compound is safe or effective for any particular patient or indication. References to clinical partners, hospital affiliations, and named practitioners reflect existing professional relationships and do not constitute endorsements of any specific product or therapeutic outcome.",
  "Use of the Mino platform is governed by the Practitioner Agreement, Terms of Service, and Privacy Policy, which together control in any conflict with the language above.",
];

type ComplianceDialogProps = {
  trigger: ReactNode;
};

export function ComplianceDialog({ trigger }: ComplianceDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0 sm:rounded-none"
        data-testid="compliance-dialog"
      >
        <div className="overflow-y-auto max-h-[88vh] p-8 md:p-12">
          <div className="border-b border-mino-forest/15 pb-6 mb-8">
            <span className="mino-eyebrow text-mino-sage-deep">
              Compliance · 2026
            </span>
            <h3 className="font-serif text-4xl md:text-5xl mt-3 leading-[1.05]">
              The Standard.
            </h3>
            <p className="mt-4 text-sm text-mino-forest/60 italic font-serif">
              How Mino sources, dispenses, and credentials &mdash; in full.
            </p>
          </div>

          <div className="space-y-5 text-mino-forest/85 leading-relaxed">
            {PARAGRAPHS.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0
                    ? "font-serif text-lg md:text-xl text-mino-forest leading-snug"
                    : "text-[15px]"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-mino-forest/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-mino-forest/55 italic">
              Questions about compliance?{" "}
              <a
                href="mailto:hello@mino.life?subject=Compliance%20inquiry"
                className="underline underline-offset-4 hover:text-mino-forest transition-colors"
              >
                hello@mino.life
              </a>
            </p>
            <button
              type="button"
              data-testid="button-compliance-close"
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
