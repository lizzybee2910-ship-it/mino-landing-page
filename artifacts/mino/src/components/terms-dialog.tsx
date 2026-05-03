import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const PREAMBLE =
  "These Terms of Service (the \u201CTerms\u201D) govern access to and use of the Mino platform, including this website and any associated portal, ordering interface, or correspondence (the \u201CPlatform\u201D), operated by Mino, Inc. (\u201CMino,\u201D \u201Cwe\u201D). The Platform is intended exclusively for licensed healthcare practitioners and credentialed clinical practices in the United States. By accessing the Platform, applying for an account, or placing an order, you (the \u201CPractitioner\u201D) agree to these Terms together with our Privacy Policy and the Practitioner Agreement executed at credentialing. In any conflict, the Practitioner Agreement controls, followed by these Terms, followed by the Privacy Policy.";

type Section = { number: string; heading: string; body: string };

const SECTIONS: Section[] = [
  {
    number: "1",
    heading: "Eligibility",
    body: "The Platform is available only to individuals and entities licensed to practice and authorized to prescribe compounded preparations in a U.S. jurisdiction in good standing. Access is conditioned on credentialing \u2014 verification of state licensure, DEA registration where applicable, and supervising relationships where required. Credentialing is continuing; the Practitioner shall promptly notify Mino of any change in licensure or scope. Mino may deny, suspend, or terminate access at its sole discretion.",
  },
  {
    number: "2",
    heading: "Nature of the Platform",
    body: "Mino is a business-to-business wholesale supply platform connecting credentialed practices to state-licensed 503A pharmacies and FDA-registered 503B outsourcing facilities. Mino is not a pharmacy, manufacturer, or compounder, does not establish a doctor-patient relationship, and does not provide medical advice. All preparations are dispensed by the partner facility identified at order, pursuant to a valid prescription for an individually identified patient.",
  },
  {
    number: "3",
    heading: "Clinical Responsibility",
    body: "Every order requires a valid prescription written by the Practitioner for an individually identified patient with whom the Practitioner has a bona fide professional relationship. The Practitioner is solely responsible for all clinical decisions \u2014 patient selection, indication, dosing, monitoring, follow-up \u2014 and for compliance with all applicable law, including off-label use. Compounded preparations are not FDA-approved and have not been evaluated by the FDA for safety or efficacy.",
  },
  {
    number: "4",
    heading: "No Medical Advice; No Endorsement",
    body: "Information on the Platform is provided for licensed practitioners only and does not constitute medical advice or a recommendation for any patient. References to clinical partners, hospital affiliations, or named practitioners do not constitute endorsements of any product, indication, or outcome.",
  },
  {
    number: "5",
    heading: "Ordering and Availability",
    body: "Orders are subject to credentialing verification and inventory at the partner facility. Pricing is wholesale and subject to change. Availability is subject to state law and may be limited or unavailable in certain jurisdictions. Orders may not be cancelled, returned, or refunded once accepted by the partner facility, except as required by law.",
  },
  {
    number: "6",
    heading: "Account Obligations",
    body: "The Practitioner shall maintain accurate credentialing, safeguard account credentials, restrict access to authorized personnel, and use the Platform only for lawful purposes. The Practitioner shall not resell, redistribute, or transfer any preparation other than to the Practitioner\u2019s own patients in the ordinary course of treatment, and shall not make any public claim about any compound that is inconsistent with applicable law.",
  },
  {
    number: "7",
    heading: "Intellectual Property",
    body: "All content on the Platform \u2014 including text, design, the Mino name and marks, formulary descriptions, references, and protocols \u2014 is the property of Mino or its licensors. The Practitioner is granted a limited, non-exclusive, non-transferable, revocable license to access the Platform in connection with the Practitioner\u2019s authorized practice. No other rights are granted.",
  },
  {
    number: "8",
    heading: "Disclaimer",
    body: "The Platform is provided \u201Cas is\u201D and \u201Cas available.\u201D To the fullest extent permitted by law, Mino disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. Mino makes no representation that any preparation is safe or effective for any patient, indication, or use. The partner facility is solely responsible for compounding, packaging, labeling, and dispensing.",
  },
  {
    number: "9",
    heading: "Limitation of Liability",
    body: "To the fullest extent permitted by law, Mino shall not be liable for any indirect, incidental, consequential, special, or punitive damages. Mino\u2019s aggregate liability arising out of or related to these Terms or the Platform shall not exceed the greater of (i) the amount paid by the Practitioner to Mino in the twelve months preceding the event giving rise to the claim, or (ii) one thousand dollars ($1,000).",
  },
  {
    number: "10",
    heading: "Indemnification",
    body: "The Practitioner shall defend and indemnify Mino against any claim arising out of the Practitioner\u2019s use of the Platform, any clinical decision, any breach of these Terms, any violation of law, or any claim brought by a patient of the Practitioner.",
  },
  {
    number: "11",
    heading: "Term and Termination",
    body: "Either party may terminate at any time. Mino may suspend or terminate access immediately for any actual or suspected violation of law or these Terms. Sections 4, 7, 8, 9, 10, and 12 survive termination.",
  },
  {
    number: "12",
    heading: "Governing Law and Disputes",
    body: "These Terms are governed by the laws of the State of New Jersey, without regard to conflict-of-laws principles. Any dispute shall be resolved by confidential, binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules in Bergen County, New Jersey, before a single arbitrator. The parties waive any right to a jury trial and any right to participate in a class or representative action. Either party may seek injunctive relief in a court of competent jurisdiction to protect intellectual property or enforce credentialing.",
  },
  {
    number: "13",
    heading: "General",
    body: "These Terms, the Privacy Policy, and the Practitioner Agreement constitute the entire agreement and supersede all prior understandings. Mino may modify these Terms by posting a revised version; continued use constitutes acceptance. If any provision is held unenforceable, the remaining provisions remain in effect.",
  },
];

type TermsDialogProps = {
  trigger: ReactNode;
};

export function TermsDialog({ trigger }: TermsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0 sm:rounded-none"
        data-testid="terms-dialog"
      >
        <div className="overflow-y-auto max-h-[88vh] p-8 md:p-12">
          <div className="border-b border-mino-forest/15 pb-6 mb-8">
            <span className="mino-eyebrow text-mino-sage-deep">
              Effective April 26, 2026
            </span>
            <h3 className="font-serif text-4xl md:text-5xl mt-3 leading-[1.05]">
              Terms of Service.
            </h3>
            <p className="mt-4 text-sm text-mino-forest/60 italic font-serif">
              The agreement between (mino) and the credentialed practitioner.
            </p>
          </div>

          <p className="font-serif text-lg md:text-xl text-mino-forest leading-snug mb-10">
            {PREAMBLE}
          </p>

          <ol className="space-y-8">
            {SECTIONS.map((section) => (
              <li
                key={section.number}
                className="grid grid-cols-[2.5rem_1fr] gap-4 md:gap-6"
              >
                <span className="mino-eyebrow text-mino-sage-deep pt-1">
                  {section.number.padStart(2, "0")}
                </span>
                <div>
                  <h4 className="font-serif text-xl md:text-2xl text-mino-forest leading-tight">
                    {section.heading}.
                  </h4>
                  <p className="mt-2 text-[15px] text-mino-forest/85 leading-relaxed">
                    {section.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 pt-6 border-t border-mino-forest/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-mino-forest/55 italic font-serif">
              A pharmacy of peptides for the practice of medicine.
            </p>
            <button
              type="button"
              data-testid="button-terms-close"
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
