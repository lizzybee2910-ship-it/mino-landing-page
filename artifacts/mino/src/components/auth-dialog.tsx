import { useState, type FormEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "signin" | "signup";

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { login, loginWithPassword, register } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");

  // Form state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);

  const [signUpFirstName, setSignUpFirstName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpBusy, setSignUpBusy] = useState(false);
  const [signUpPendingVerification, setSignUpPendingVerification] = useState(false);
  const [signUpDevToken, setSignUpDevToken] = useState<string | null>(null);

  function reset() {
    setSignInEmail("");
    setSignInPassword("");
    setSignInError(null);
    setSignUpFirstName("");
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpError(null);
    setSignUpPendingVerification(false);
    setSignUpDevToken(null);
    setMode("signin");
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setSignInBusy(true);
    try {
      await loginWithPassword({
        email: signInEmail,
        password: signInPassword,
      });
      reset();
      onOpenChange(false);
      // Reload so every useAuth() consumer (nav, etc.) re-fetches the new session.
      window.location.reload();
    } catch (err) {
      setSignInError(
        err instanceof Error ? err.message : "Sign in failed.",
      );
      setSignInBusy(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSignUpError(null);
    setSignUpBusy(true);
    try {
      const result = await register({
        email: signUpEmail,
        password: signUpPassword,
        firstName: signUpFirstName.trim() || null,
      });
      if (result.requiresVerification) {
        setSignUpPendingVerification(true);
        setSignUpDevToken(result.devVerificationToken ?? null);
        setSignUpBusy(false);
      } else {
        reset();
        onOpenChange(false);
        window.location.reload();
      }
    } catch (err) {
      setSignUpError(
        err instanceof Error ? err.message : "Account creation failed.",
      );
      setSignUpBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSignInError(null);
          setSignUpError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid="dialog-auth"
        className="max-w-md rounded-none border-mino-forest/15 bg-mino-cream text-mino-forest p-0 gap-0"
      >
        <div className="px-7 pt-8 pb-5 border-b border-mino-forest/10">
          <span className="mino-eyebrow text-mino-sage-deep">
            Members · (mino)
          </span>
          <DialogTitle className="mt-3 font-serif text-3xl text-mino-forest">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </DialogTitle>
          <DialogDescription className="mt-2 font-serif text-sm text-mino-forest/85">
            {mode === "signin"
              ? "Welcome back. Continue your protocol."
              : "Join the directory of clinicians and partners."}
          </DialogDescription>
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="px-7 pt-5"
        >
          <TabsList
            className="grid grid-cols-2 w-full bg-mino-bone/60 p-1 rounded-none h-auto"
            data-testid="tabs-auth-mode"
          >
            <TabsTrigger
              value="signin"
              data-testid="tab-signin"
              className="rounded-none mino-eyebrow data-[state=active]:bg-mino-cream data-[state=active]:text-mino-forest text-mino-forest/85"
            >
              Sign in
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              data-testid="tab-signup"
              className="rounded-none mino-eyebrow data-[state=active]:bg-mino-cream data-[state=active]:text-mino-forest text-mino-forest/85"
            >
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6 mb-2">
            <form
              onSubmit={handleSignIn}
              className="flex flex-col gap-4"
              data-testid="form-signin"
            >
              <FieldLabel htmlFor="signin-email">Email</FieldLabel>
              <input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                data-testid="input-signin-email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                className={inputClass}
              />

              <FieldLabel htmlFor="signin-password">Password</FieldLabel>
              <input
                id="signin-password"
                type="password"
                required
                autoComplete="current-password"
                data-testid="input-signin-password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                className={inputClass}
              />

              {signInError && (
                <p
                  data-testid="error-signin"
                  className="font-serif text-sm text-red-700"
                >
                  {signInError}
                </p>
              )}

              <button
                type="submit"
                disabled={signInBusy}
                data-testid="button-submit-signin"
                className={`${primaryButtonClass} mt-1`}
              >
                {signInBusy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6 mb-2">
            {signUpPendingVerification ? (
              <div className="flex flex-col gap-4 pb-2" data-testid="signup-pending-verification">
                <p className="font-serif text-sm text-mino-forest/90">
                  Account created for <strong>{signUpEmail}</strong>.
                  To verify your email and activate your account, sign in with
                  Replit — we use your Replit account to confirm email ownership.
                </p>
                {signUpDevToken && (
                  <div className="rounded border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900" data-testid="dev-verification-token">
                    <p className="font-semibold mb-1">Development mode — verification token</p>
                    <p className="mb-2 text-amber-700">
                      Email delivery is not yet configured. Use this token to call{" "}
                      <code className="font-mono">POST /api/auth/verify-email</code>{" "}
                      with <code className="font-mono">{`{"token":"<token>"}`}</code>.
                      This field is only included in non-production environments.
                    </p>
                    <code className="block break-all font-mono text-amber-900 select-all">{signUpDevToken}</code>
                  </div>
                )}
                <button
                  type="button"
                  onClick={login}
                  className={primaryButtonClass}
                >
                  Sign in with Replit to verify
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className={secondaryButtonClass}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
            <form
              onSubmit={handleSignUp}
              className="flex flex-col gap-4"
              data-testid="form-signup"
            >
              <FieldLabel htmlFor="signup-name">First name (optional)</FieldLabel>
              <input
                id="signup-name"
                type="text"
                autoComplete="given-name"
                data-testid="input-signup-firstname"
                value={signUpFirstName}
                onChange={(e) => setSignUpFirstName(e.target.value)}
                className={inputClass}
              />

              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                data-testid="input-signup-email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                className={inputClass}
              />

              <FieldLabel htmlFor="signup-password">
                Password (min 8 characters)
              </FieldLabel>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                data-testid="input-signup-password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                className={inputClass}
              />

              {signUpError && (
                <p
                  data-testid="error-signup"
                  className="font-serif text-sm text-red-700"
                >
                  {signUpError}
                </p>
              )}

              <button
                type="submit"
                disabled={signUpBusy}
                data-testid="button-submit-signup"
                className={`${primaryButtonClass} mt-1`}
              >
                {signUpBusy ? "Creating account…" : "Create account"}
              </button>
            </form>
            )}
          </TabsContent>
        </Tabs>

        <div className="px-7 pt-2 pb-7" />
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mino-eyebrow text-mino-sage-deep -mb-3"
    >
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-mino-cream border border-mino-forest/20 focus:border-mino-forest/60 outline-none px-3 py-2.5 font-serif text-mino-forest placeholder:text-mino-forest/40 transition-colors";

const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-3";

const secondaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-5 py-3";
