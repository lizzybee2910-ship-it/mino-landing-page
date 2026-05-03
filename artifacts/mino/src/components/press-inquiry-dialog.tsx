import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const PRESS_EMAIL = "hello@mino.life";

type PressFormState = {
  name: string;
  outlet: string;
  email: string;
  deadline: string;
  message: string;
};

const EMPTY_FORM: PressFormState = {
  name: "",
  outlet: "",
  email: "",
  deadline: "",
  message: "",
};

type FieldErrors = Partial<Record<keyof PressFormState, string>>;

function validate(values: PressFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Please share your name.";
  if (!values.outlet.trim()) errors.outlet = "Please tell us your outlet.";
  if (!values.email.trim()) {
    errors.email = "An email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "That doesn't look like a valid email.";
  }
  if (!values.message.trim())
    errors.message = "Tell us a little about your inquiry.";
  return errors;
}

function buildMailto(values: PressFormState): string {
  const subject = `Press inquiry — ${values.outlet.trim()} (${values.name.trim()})`;
  const lines = [
    `Name: ${values.name.trim()}`,
    `Outlet / Publication: ${values.outlet.trim()}`,
    `Reply-to: ${values.email.trim()}`,
  ];
  if (values.deadline.trim()) lines.push(`Deadline: ${values.deadline.trim()}`);
  lines.push("", "Inquiry:", values.message.trim());
  const body = lines.join("\n");
  return `mailto:${PRESS_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

type PressInquiryDialogProps = {
  trigger: ReactNode;
};

export function PressInquiryDialog({ trigger }: PressInquiryDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PressFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof PressFormState>(
    key: K,
    value: PressFormState[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  const resetForm = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setSubmitted(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    window.location.href = buildMailto(values);
    setSubmitted(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onCloseAutoFocus={() => resetForm()}
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-xl p-0 gap-0 sm:rounded-none"
      >
        <div className="p-8 md:p-10">
          {submitted ? (
            <div data-testid="press-inquiry-success">
              <span className="mino-eyebrow text-mino-sage-deep">
                Inquiry routed
              </span>
              <h3 className="font-serif text-3xl md:text-4xl mt-4 leading-tight">
                Your mail client just opened.
              </h3>
              <p className="mt-5 text-mino-forest/88 leading-relaxed">
                Send the message from there to reach{" "}
                <span className="font-serif italic text-mino-forest">
                  {PRESS_EMAIL}
                </span>
                . We typically respond within two business days.
              </p>
              <div className="mt-8 flex items-center gap-6">
                <button
                  type="button"
                  data-testid="button-press-reset"
                  onClick={() => {
                    setValues(EMPTY_FORM);
                    setErrors({});
                    setSubmitted(false);
                  }}
                  className="mino-eyebrow text-mino-forest underline underline-offset-4 hover:text-mino-sage-deep transition-colors"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="mino-eyebrow text-mino-forest/60 hover:text-mino-forest transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              data-testid="press-inquiry-form"
              noValidate
              className="space-y-6"
            >
              <div>
                <span className="mino-eyebrow text-mino-sage-deep">
                  Press · Media
                </span>
                <h3 className="font-serif text-3xl md:text-4xl mt-3 leading-tight">
                  Press inquiry.
                </h3>
                <p className="mt-3 text-sm text-mino-forest/85 leading-relaxed">
                  For interviews, commentary, and editorial requests. Submissions
                  reach{" "}
                  <span className="font-serif italic">{PRESS_EMAIL}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PressField
                  id="press-name"
                  label="Name"
                  error={errors.name}
                  data-testid="error-press-name"
                >
                  <input
                    id="press-name"
                    data-testid="input-press-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Avery Linden"
                    value={values.name}
                    onChange={(e) => update("name", e.target.value)}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? "press-name-error" : undefined}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </PressField>

                <PressField
                  id="press-outlet"
                  label="Outlet / Publication"
                  error={errors.outlet}
                  data-testid="error-press-outlet"
                >
                  <input
                    id="press-outlet"
                    data-testid="input-press-outlet"
                    type="text"
                    placeholder="The Atlantic"
                    value={values.outlet}
                    onChange={(e) => update("outlet", e.target.value)}
                    aria-invalid={errors.outlet ? true : undefined}
                    aria-describedby={errors.outlet ? "press-outlet-error" : undefined}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </PressField>

                <PressField
                  id="press-email"
                  label="Email"
                  error={errors.email}
                  data-testid="error-press-email"
                >
                  <input
                    id="press-email"
                    data-testid="input-press-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@outlet.com"
                    value={values.email}
                    onChange={(e) => update("email", e.target.value)}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "press-email-error" : undefined}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </PressField>

                <PressField
                  id="press-deadline"
                  label={
                    <>
                      Deadline <span className="lowercase">(optional)</span>
                    </>
                  }
                >
                  <input
                    id="press-deadline"
                    data-testid="input-press-deadline"
                    type="text"
                    placeholder="Fri, May 9"
                    value={values.deadline}
                    onChange={(e) => update("deadline", e.target.value)}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </PressField>
              </div>

              <PressField
                id="press-message"
                label="Inquiry"
                error={errors.message}
                data-testid="error-press-message"
              >
                <textarea
                  id="press-message"
                  data-testid="input-press-message"
                  rows={4}
                  placeholder="Tell us about the story, your angle, and what you're hoping to learn."
                  value={values.message}
                  onChange={(e) => update("message", e.target.value)}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={errors.message ? "press-message-error" : undefined}
                  className="w-full bg-transparent border border-mino-forest/20 focus:border-mino-forest outline-none p-3 font-sans text-sm text-mino-forest placeholder:text-mino-forest/40 resize-none"
                />
              </PressField>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <p className="text-xs text-mino-forest/55 italic">
                  Submitting opens your email client addressed to{" "}
                  {PRESS_EMAIL}.
                </p>
                <button
                  type="submit"
                  data-testid="button-press-submit"
                  className="inline-flex items-center justify-center mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-8 py-4"
                >
                  Send Inquiry
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PressFieldProps = {
  id: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
  "data-testid"?: string;
};

function PressField({
  id,
  label,
  error,
  children,
  "data-testid": testId,
}: PressFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="mino-eyebrow text-mino-forest/85 block"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          data-testid={testId}
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
