import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const PREAMBLE =
  "This Privacy Policy describes the information Mino, Inc. (\u201CMino,\u201D \u201Cwe\u201D) collects from practitioners using the Mino platform (the \u201CPlatform\u201D), how we use and share it, and the rights available. The Platform is intended exclusively for licensed healthcare practitioners and credentialed clinical practices in the United States. It is not directed to consumers or to children. Read together with our Terms of Service and the Practitioner Agreement; in any conflict, the Practitioner Agreement controls.";

type Section = { number: string; heading: string; body: string };

const SECTIONS: Section[] = [
  {
    number: "1",
    heading: "Information We Collect",
    body: "We collect: (a) credentialing information, including name, license number, state, license type, DEA registration where applicable, NPI, board certifications, supervising relationships, and supporting documentation; (b) practice and account information, including practice and billing addresses, tax identification, and professional contact details; (c) order and transaction information, including compounds ordered, prescriptions, dates, partner facility, pricing, payment, and shipping; (d) platform-use information, including pages visited, features used, login records, IP address, device identifiers, and cookies; and (e) correspondence with Mino. We do not knowingly collect protected health information of a practitioner\u2019s individual patients.",
  },
  {
    number: "2",
    heading: "How We Use Information",
    body: "We use information to verify licensure and ongoing eligibility; to process and fulfill orders through partner pharmacies and outsourcing facilities; to provide clinical references, protocols, and the clinical line; to operate, secure, and improve the Platform; to communicate about the account and material changes; to comply with applicable law (including pharmacy, controlled-substance, tax, and recordkeeping requirements); to investigate suspected violations; and to establish, exercise, or defend legal claims. We do not sell, rent, or share practitioner information for the marketing purposes of any third party.",
  },
  {
    number: "3",
    heading: "Cookies and Similar Technologies",
    body: "The Platform uses first-party and limited third-party cookies for sessions, preferences, security, and aggregate analytics. Disabling cookies may impair core functionality. The Platform does not currently respond to \u201CDo Not Track\u201D browser signals; all visitors are treated consistently with this Policy.",
  },
  {
    number: "4",
    heading: "When We Share Information",
    body: "We share information: (a) with the partner pharmacy or outsourcing facility identified at order, for dispensing and shipping; (b) with service providers operating components of the Platform on our behalf, under confidentiality and limited-use obligations; (c) with legal and regulatory authorities when required by law, valid legal process, or in good-faith protection of rights and safety; (d) with a successor entity in connection with a merger, acquisition, or reorganization, on commitments consistent with this Policy; and (e) with the practitioner\u2019s consent.",
  },
  {
    number: "5",
    heading: "HIPAA and Protected Health Information",
    body: "Mino is not a covered entity under the Health Insurance Portability and Accountability Act. To the extent the Platform receives or transmits protected health information (PHI) in the course of fulfilling an order, Mino acts as a conduit for transmission to the partner facility. Where required, Mino will enter into a Business Associate Agreement with the practitioner. Absent an executed BAA, the practitioner shall not transmit PHI through the Platform other than the minimum necessary to fulfill an order.",
  },
  {
    number: "6",
    heading: "Security",
    body: "We maintain administrative, technical, and physical safeguards designed to protect practitioner information, including encryption in transit, access controls, audit logging, and periodic review. No method of transmission or storage is perfectly secure. The practitioner is responsible for safeguarding account credentials. In the event of a security incident affecting practitioner information, we will notify affected parties as required by law.",
  },
  {
    number: "7",
    heading: "Retention",
    body: "Credentialing records are retained for the life of the account and at least seven years thereafter, or longer where required by state law. Order and prescription records are retained for at least seven years from fulfillment. Account correspondence is retained for at least three years. Platform-use logs are retained consistent with industry practice and regulatory requirements. After applicable periods, information is deleted, anonymized, or returned, except where retention is necessary for legal claims.",
  },
  {
    number: "8",
    heading: "Practitioner Rights",
    body: "Practitioners may request access to, correction of, or \u2014 subject to applicable retention obligations \u2014 deletion of personal information we hold. Where state law (including the California Consumer Privacy Act, the New York SHIELD Act, or comparable regimes) applies, rights may be exercised under that law. Some rights are limited by professional licensing, pharmacy, controlled-substance, and recordkeeping obligations Mino is required to maintain. Requests may be sent to the address below; we respond within the time required by law.",
  },
  {
    number: "9",
    heading: "Geographic Scope",
    body: "The Platform is operated from the United States and intended for use by licensed practitioners located in the United States. The Platform is not directed to users in any other jurisdiction. Information is processed and stored in the United States.",
  },
  {
    number: "10",
    heading: "Children",
    body: "The Platform is intended exclusively for licensed practitioners. Mino does not direct the Platform to, and does not knowingly collect information from, individuals under eighteen. If we learn that information has been collected from such an individual, we will delete it.",
  },
  {
    number: "11",
    heading: "Changes to This Policy",
    body: "Mino may modify this Policy by posting a revised version. The effective date above reflects the most recent revision. Material changes will be communicated through the Platform or by direct notice. Continued use following any modification constitutes acceptance.",
  },
  {
    number: "12",
    heading: "Contact",
    body: "Questions, requests, and notices regarding this Policy may be sent to privacy@mino.life.",
  },
];

type PrivacyDialogProps = {
  trigger: ReactNode;
};

export function PrivacyDialog({ trigger }: PrivacyDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0 sm:rounded-none"
        data-testid="privacy-dialog"
      >
        <div className="overflow-y-auto max-h-[88vh] p-8 md:p-12">
          <div className="border-b border-mino-forest/15 pb-6 mb-8">
            <span className="mino-eyebrow text-mino-sage-deep">
              Effective April 26, 2026
            </span>
            <h3 className="font-serif text-4xl md:text-5xl mt-3 leading-[1.05]">
              Privacy Policy.
            </h3>
            <p className="mt-4 text-sm text-mino-forest/60 italic font-serif">
              How (mino) collects, uses, and protects practitioner information.
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
              Privacy questions:{" "}
              <a
                href="mailto:privacy@mino.life"
                className="not-italic underline underline-offset-4 hover:text-mino-forest transition-colors"
              >
                privacy@mino.life
              </a>
            </p>
            <button
              type="button"
              data-testid="button-privacy-close"
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
