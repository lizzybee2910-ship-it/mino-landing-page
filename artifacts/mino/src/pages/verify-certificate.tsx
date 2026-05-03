import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Award,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  verifyCertificate,
  type LearnVerifiedCertificate,
} from "@/lib/learn-api";

interface Props {
  params: { certificateId: string };
}

/**
 * Public, unauthenticated verification page. Anyone holding a printed or
 * digital copy of a (mino) certificate can paste the URL printed in the
 * footer here to confirm it is genuine. Renders only metadata that is
 * already on the certificate itself — no PII beyond the member's
 * display name.
 */
export default function VerifyCertificatePage({ params }: Props) {
  const certificateId = params.certificateId;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["learn", "verify", certificateId],
    queryFn: () => verifyCertificate(certificateId),
    retry: false,
  });

  return (
    <main
      data-testid="page-verify-certificate"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">
            Vol. II · Certificate verification
          </span>
        </div>

        {isLoading && (
          <p
            data-testid="verify-loading"
            className="font-serif text-mino-forest/60"
          >
            Looking up certificate {certificateId}…
          </p>
        )}

        {isError && (
          <NotFoundCard
            message={
              (error as Error)?.message ?? "We couldn't reach the verification service."
            }
            certificateId={certificateId}
          />
        )}

        {!isLoading && !isError && data === null && (
          <NotFoundCard
            message="That certificate id doesn't match any record we have."
            certificateId={certificateId}
          />
        )}

        {!isLoading && !isError && data && <VerifiedCard certificate={data} />}

        <p className="mt-12 font-serif text-mino-forest/60">
          Looking for your own certificates?{" "}
          <Link
            href="/learn/me"
            className="text-mino-forest underline underline-offset-4 hover:text-mino-ink"
          >
            Sign in to your library
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function VerifiedCard({
  certificate,
}: {
  certificate: LearnVerifiedCertificate;
}) {
  const issued = new Date(certificate.issuedAt);
  return (
    <article
      data-testid="verify-valid"
      className="border border-mino-forest/15 bg-mino-bone/30 p-8 md:p-10"
    >
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck
          className="h-6 w-6 text-mino-sage-deep"
          aria-hidden
        />
        <span className="mino-eyebrow text-mino-sage-deep">
          Genuine certificate
        </span>
      </div>

      <h1
        data-testid="verify-course-title"
        className="font-serif text-4xl md:text-5xl text-mino-forest leading-tight mb-6"
      >
        {certificate.courseTitle}
      </h1>

      <dl className="grid gap-5 sm:grid-cols-2">
        <div>
          <dt className="mino-eyebrow text-mino-sage-deep mb-1">
            Awarded to
          </dt>
          <dd
            data-testid="verify-member-name"
            className="font-serif text-xl text-mino-forest"
          >
            {certificate.memberName}
          </dd>
        </div>
        <div>
          <dt className="mino-eyebrow text-mino-sage-deep mb-1">Issued</dt>
          <dd
            data-testid="verify-issued"
            className="font-serif text-xl text-mino-forest"
          >
            {issued.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </dd>
        </div>
        <div>
          <dt className="mino-eyebrow text-mino-sage-deep mb-1">Issued by</dt>
          <dd className="font-serif text-xl text-mino-forest">
            {certificate.issuer}
          </dd>
        </div>
        <div>
          <dt className="mino-eyebrow text-mino-sage-deep mb-1">
            Certificate ID
          </dt>
          <dd
            data-testid="verify-certificate-id"
            className="font-mono text-sm text-mino-forest/90 break-all"
          >
            {certificate.certificateId}
          </dd>
        </div>
      </dl>

      <p className="mt-8 flex items-center gap-2 font-serif text-mino-forest/85">
        <CheckCircle2
          className="h-4 w-4 text-mino-sage-deep"
          aria-hidden
        />
        Every lesson in this course was completed by the named member.
      </p>

      <div className="mt-8 pt-6 border-t border-mino-forest/10 flex items-center gap-3 text-mino-forest/85">
        <Award className="h-4 w-4 text-mino-sage-deep" aria-hidden />
        <span className="font-serif text-sm">
          (mino) — the magazine, the library, the practice.
        </span>
      </div>
    </article>
  );
}

function NotFoundCard({
  message,
  certificateId,
}: {
  message: string;
  certificateId: string;
}) {
  return (
    <article
      data-testid="verify-invalid"
      className="border border-red-700/20 bg-red-50/50 p-8 md:p-10"
    >
      <div className="flex items-center gap-3 mb-4">
        <ShieldAlert className="h-6 w-6 text-red-700" aria-hidden />
        <span className="mino-eyebrow text-red-700">
          Could not verify
        </span>
      </div>
      <h1 className="font-serif text-3xl text-mino-forest leading-tight mb-3">
        We couldn't confirm this certificate.
      </h1>
      <p
        data-testid="verify-error"
        className="font-serif text-mino-forest/85"
      >
        {message}
      </p>
      <p className="mt-4 font-mono text-sm text-mino-forest/50 break-all">
        Lookup id: {certificateId}
      </p>
    </article>
  );
}
