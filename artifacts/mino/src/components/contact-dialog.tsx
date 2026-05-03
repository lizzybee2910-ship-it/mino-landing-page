import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const CONTACT_EMAIL = "hello@mino.life";

type ContactFormState = {
  name: string;
  email: string;
  practice: string;
  topic: string;
  message: string;
};

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  practice: "",
  topic: "General",
  message: "",
};

const TOPICS = [
  "General",
  "Practitioner inquiry",
  "Partnership",
  "Press",
  "Other",
];

type FieldErrors = Partial<Record<keyof ContactFormState, string>>;

function validate(values: ContactFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Please share your name.";
  if (!values.email.trim()) {
    errors.email = "An email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "That doesn't look like a valid email.";
  }
  if (!values.message.trim())
    errors.message = "Tell us a little about why you're reaching out.";
  return errors;
}

function buildMailto(values: ContactFormState): string {
  const subject = `${values.topic} — ${values.name.trim()}`;
  const lines = [
    `Name: ${values.name.trim()}`,
    `Reply-to: ${values.email.trim()}`,
  ];
  if (values.practice.trim())
    lines.push(`Practice / Affiliation: ${values.practice.trim()}`);
  lines.push(`Topic: ${values.topic}`, "", "Message:", values.message.trim());
  const body = lines.join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

type ContactDialogProps = {
  trigger: ReactNode;
};

export function ContactDialog({ trigger }: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ContactFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onCloseAutoFocus={() => resetForm()}
        className="bg-mino-cream text-mino-forest border border-mino-forest/15 sm:max-w-xl p-0 gap-0 sm:rounded-none"
      >
        <div className="p-8 md:p-10">
          {submitted ? (
            <div data-testid="contact-success">
              <span className="mino-eyebrow text-mino-sage-deep">
                Message routed
              </span>
              <h3 className="font-serif text-3xl md:text-4xl mt-4 leading-tight">
                Your mail client just opened.
              </h3>
              <p className="mt-5 text-mino-forest/88 leading-relaxed">
                Send the message from there to reach{" "}
                <span className="font-serif italic text-mino-forest">
                  {CONTACT_EMAIL}
                </span>
                . We typically respond within two business days.
              </p>
              <div className="mt-8 flex items-center gap-6">
                <button
                  type="button"
                  data-testid="button-contact-reset"
                  onClick={resetForm}
                  className="mino-eyebrow text-mino-forest underline underline-offset-4 hover:text-mino-sage-deep transition-colors"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mino-eyebrow text-mino-forest/60 hover:text-mino-forest transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              data-testid="contact-form"
              noValidate
              className="space-y-6"
            >
              <div>
                <span className="mino-eyebrow text-mino-sage-deep">
                  Get in touch
                </span>
                <h3 className="font-serif text-3xl md:text-4xl mt-3 leading-tight">
                  Contact (mino).
                </h3>
                <p className="mt-3 text-sm text-mino-forest/85 leading-relaxed">
                  Questions, partnerships, or quiet introductions. Submissions
                  reach{" "}
                  <span className="font-serif italic">{CONTACT_EMAIL}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ContactField
                  id="contact-name"
                  label="Name"
                  error={errors.name}
                  data-testid="error-contact-name"
                >
                  <input
                    id="contact-name"
                    data-testid="input-contact-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={values.name}
                    onChange={(e) => update("name", e.target.value)}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={
                      errors.name ? "contact-name-error" : undefined
                    }
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </ContactField>

                <ContactField
                  id="contact-email"
                  label="Email"
                  error={errors.email}
                  data-testid="error-contact-email"
                >
                  <input
                    id="contact-email"
                    data-testid="input-contact-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@domain.com"
                    value={values.email}
                    onChange={(e) => update("email", e.target.value)}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={
                      errors.email ? "contact-email-error" : undefined
                    }
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </ContactField>

                <ContactField
                  id="contact-practice"
                  label={
                    <>
                      Practice / Affiliation{" "}
                      <span className="lowercase">(optional)</span>
                    </>
                  }
                >
                  <input
                    id="contact-practice"
                    data-testid="input-contact-practice"
                    type="text"
                    placeholder="Clinic, outlet, organization"
                    value={values.practice}
                    onChange={(e) => update("practice", e.target.value)}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </ContactField>

                <ContactField id="contact-topic" label="Topic">
                  <select
                    id="contact-topic"
                    data-testid="select-contact-topic"
                    value={values.topic}
                    onChange={(e) => update("topic", e.target.value)}
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest appearance-none cursor-pointer"
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </ContactField>
              </div>

              <ContactField
                id="contact-message"
                label="Message"
                error={errors.message}
                data-testid="error-contact-message"
              >
                <textarea
                  id="contact-message"
                  data-testid="input-contact-message"
                  rows={4}
                  placeholder="Tell us a little about why you're reaching out."
                  value={values.message}
                  onChange={(e) => update("message", e.target.value)}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={
                    errors.message ? "contact-message-error" : undefined
                  }
                  className="w-full bg-transparent border border-mino-forest/20 focus:border-mino-forest outline-none p-3 font-sans text-sm text-mino-forest placeholder:text-mino-forest/40 resize-none"
                />
              </ContactField>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <p className="text-xs text-mino-forest/55 italic">
                  Submitting opens your email client addressed to{" "}
                  {CONTACT_EMAIL}.
                </p>
                <button
                  type="submit"
                  data-testid="button-contact-submit"
                  className="inline-flex items-center justify-center mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-8 py-4"
                >
                  Send Message
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ContactFieldProps = {
  id: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
  "data-testid"?: string;
};

function ContactField({
  id,
  label,
  error,
  children,
  "data-testid": testId,
}: ContactFieldProps) {
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
