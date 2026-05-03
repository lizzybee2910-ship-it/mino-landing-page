import { Link } from "wouter";
import { homeHashHref } from "@/lib/links";
import { ThemeToggle } from "@/components/theme-toggle";
import { PressInquiryDialog } from "@/components/press-inquiry-dialog";
import { ComplianceDialog } from "@/components/compliance-dialog";
import { ContactDialog } from "@/components/contact-dialog";
import { TermsDialog } from "@/components/terms-dialog";
import { PrivacyDialog } from "@/components/privacy-dialog";
import { PromiseDialog } from "@/components/promise-dialog";

export function Footer() {
  return (
    <footer
      data-testid="footer-main"
      className="bg-mino-forest text-mino-cream pt-24 pb-10 px-6 md:px-12"
    >
      <div className="max-w-[88rem] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-6">
            <span
              aria-label="(mino)"
              className="block font-serif leading-none text-mino-cream/95 text-5xl md:text-6xl tracking-[-0.02em] select-none"
            >
              (mino)
            </span>
            <p className="mt-8 max-w-md text-mino-cream/70 font-serif text-xl italic leading-relaxed">
              The premium standard in peptide health.
            </p>
          </div>

          <div className="md:col-span-2">
            <h4 className="mino-eyebrow text-mino-sage mb-6">Platform</h4>
            <ul className="space-y-3 text-sm text-mino-cream/80">
              <li>
                <Link
                  href="/catalog"
                  data-testid="link-footer-catalog"
                  className="hover:text-mino-cream transition-colors"
                >
                  Catalog
                </Link>
              </li>
              <li><a href={homeHashHref("partners")} className="hover:text-mino-cream transition-colors">For Clinicians</a></li>
              <li><a href={homeHashHref("patients")} className="hover:text-mino-cream transition-colors">For Patients</a></li>
              <li><a href={homeHashHref("standard")} className="hover:text-mino-cream transition-colors">The Standard</a></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="mino-eyebrow text-mino-sage mb-6">Company</h4>
            <ul className="space-y-3 text-sm text-mino-cream/80">
              <li>
                <PromiseDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-promise"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      The Promise
                    </button>
                  }
                />
              </li>
              <li><a href={homeHashHref("waitlist")} className="hover:text-mino-cream transition-colors">Access</a></li>
              <li>
                <PressInquiryDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-press"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      Press
                    </button>
                  }
                />
              </li>
              <li>
                <ContactDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-contact"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      Contact
                    </button>
                  }
                />
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="mino-eyebrow text-mino-sage mb-6">Legal</h4>
            <ul className="space-y-3 text-sm text-mino-cream/80">
              <li>
                <PrivacyDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-privacy"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      Privacy
                    </button>
                  }
                />
              </li>
              <li>
                <TermsDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-terms"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      Terms
                    </button>
                  }
                />
              </li>
              <li>
                <ComplianceDialog
                  trigger={
                    <button
                      type="button"
                      data-testid="link-footer-compliance"
                      className="hover:text-mino-cream transition-colors text-left"
                    >
                      Compliance
                    </button>
                  }
                />
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-mino-cream/15 flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-4 text-xs text-mino-cream/50">
          <p>&copy; {new Date().getFullYear()} (mino). All rights reserved.</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <ThemeToggle tone="cream" />
            <p className="mino-eyebrow text-mino-sage">
              Clinically formulated · Provider vetted · Quality certified
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
