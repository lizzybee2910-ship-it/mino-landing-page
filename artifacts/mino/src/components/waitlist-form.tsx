import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateWaitlistSignup,
  type WaitlistRole,
} from "@workspace/api-client-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ROLE_OPTIONS: { value: WaitlistRole; label: string }[] = [
  { value: "provider", label: "Provider" },
  { value: "clinic_owner", label: "Clinic owner" },
  { value: "partner", label: "Partner" },
  { value: "patient", label: "Patient" },
  { value: "other", label: "Other" },
];

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please share your name.")
    .max(200),
  email: z
    .string()
    .trim()
    .min(1, "An email is required.")
    .email("That doesn't look like a valid email."),
  role: z.enum([
    "provider",
    "clinic_owner",
    "partner",
    "patient",
    "other",
  ]),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function WaitlistForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "provider",
      notes: "",
    },
  });

  const mutation = useCreateWaitlistSignup({
    mutation: {
      onSuccess: () => {
        setServerError(null);
        setSubmitted(true);
        form.reset();
      },
      onError: () => {
        setServerError("We could not submit your request. Please try again.");
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    mutation.mutate({
      data: {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      },
    });
  });

  if (submitted) {
    return (
      <div
        data-testid="waitlist-success"
        className="bg-mino-cream border border-mino-forest/15 p-10 md:p-14"
      >
        <span className="mino-eyebrow text-mino-sage-deep">
          Request received
        </span>
        <h3 className="font-serif text-3xl md:text-4xl text-mino-forest mt-4 leading-tight">
          Welcome. We'll be in touch.
        </h3>
        <p className="mt-5 text-mino-forest/85 max-w-md leading-relaxed">
          We've received your request. We'll send a quiet, considered note with
          your next steps — no marketing noise, no follow-up sequences.
        </p>
        <button
          type="button"
          data-testid="button-waitlist-reset"
          onClick={() => setSubmitted(false)}
          className="mt-8 mino-eyebrow text-mino-forest underline underline-offset-4 hover:text-mino-sage-deep transition-colors"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        data-testid="waitlist-form"
        noValidate
        className="bg-mino-cream border border-mino-forest/15 p-8 md:p-12 space-y-7"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="mino-eyebrow text-mino-forest/85">
                  Name
                </FormLabel>
                <FormControl>
                  <input
                    {...field}
                    data-testid="input-waitlist-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Dr. Avery Linden"
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </FormControl>
                <FormMessage data-testid="error-name" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="mino-eyebrow text-mino-forest/85">
                  Email
                </FormLabel>
                <FormControl>
                  <input
                    {...field}
                    data-testid="input-waitlist-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@practice.com"
                    className="w-full bg-transparent border-b border-mino-forest/30 focus:border-mino-forest outline-none py-2 font-serif text-lg text-mino-forest placeholder:text-mino-forest/40"
                  />
                </FormControl>
                <FormMessage data-testid="error-email" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="mino-eyebrow text-mino-forest/85">
                I am a&hellip;
              </FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="cursor-pointer"
                      data-testid={`role-option-${opt.value}`}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        checked={field.value === opt.value}
                        onChange={() => field.onChange(opt.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        className="peer sr-only"
                      />
                      <span className="block text-center text-sm py-3 px-2 border border-mino-forest/20 text-mino-forest/85 hover:border-mino-forest/60 hover:text-mino-forest transition-colors peer-checked:bg-mino-forest peer-checked:text-mino-cream peer-checked:border-mino-forest">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="mino-eyebrow text-mino-forest/85">
                Notes <span className="lowercase">(optional)</span>
              </FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  data-testid="input-waitlist-notes"
                  rows={3}
                  placeholder="Tell us about your practice or what you're hoping to find."
                  className="w-full bg-transparent border border-mino-forest/20 focus:border-mino-forest outline-none p-3 font-sans text-sm text-mino-forest placeholder:text-mino-forest/40 resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <div
            data-testid="server-error"
            className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
          <p className="text-xs text-mino-forest/60 italic">
            No spam. Just a quiet note with your next steps.
          </p>
          <button
            type="submit"
            data-testid="button-waitlist-submit"
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-8 py-4"
          >
            {mutation.isPending ? "Sending\u2026" : "Request Access"}
          </button>
        </div>
      </form>
    </Form>
  );
}
