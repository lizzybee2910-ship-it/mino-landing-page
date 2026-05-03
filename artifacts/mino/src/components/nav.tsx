import { Link } from "wouter";
import { useState, useEffect } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { homeHashHref } from "@/lib/links";
import { useTheme } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthDialog } from "@/components/auth-dialog";
import minoLogoBlack from "@assets/Mino_logo_black_transparent.png";

const FIELD_GUIDE_LINKS: { label: string; hash: string; testId: string }[] = [
  {
    label: "Cognitive",
    hash: "editorial-cognitive",
    testId: "link-editorial-cognitive",
  },
  {
    label: "Growth Hormone",
    hash: "editorial-growth-hormone",
    testId: "link-editorial-growth-hormone",
  },
  {
    label: "Longevity",
    hash: "editorial-longevity",
    testId: "link-editorial-longevity",
  },
  {
    label: "Recovery",
    hash: "editorial-recovery",
    testId: "link-editorial-recovery",
  },
  {
    label: "Sexual Wellness",
    hash: "editorial-sexual-wellness",
    testId: "link-editorial-sexual-wellness",
  },
  { label: "Skin", hash: "editorial-skin", testId: "link-editorial-skin" },
  {
    label: "Specialty & Sleep",
    hash: "editorial-specialty-sleep",
    testId: "link-editorial-specialty-sleep",
  },
  {
    label: "Metabolic",
    hash: "editorial-metabolic",
    testId: "link-editorial-metabolic",
  },
];

const PRIMARY_LINKS: {
  label: string;
  hash?: string;
  to?: string;
  testId: string;
}[] = [
  { label: "Positioning", hash: "positioning", testId: "mobile-link-positioning" },
  { label: "Catalog", to: "/catalog", testId: "mobile-link-catalog" },
  { label: "Learn", to: "/learn", testId: "mobile-link-learn" },
  { label: "Partners", hash: "partners", testId: "mobile-link-partners" },
  { label: "Standard", hash: "standard", testId: "mobile-link-standard" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The hero behind an unscrolled nav uses `bg-mino-forest` (deep ficus
  // in light mode, paper tone in dark mode). The pinned nav background
  // uses `bg-mino-cream`, which inverts the same way. So the backdrop is
  // dark exactly when the two booleans agree:
  //   !scrolled (over hero)   && !isDark  -> hero is dark   -> invert
  //    scrolled (over fill)   &&  isDark  -> fill is dark   -> invert
  // i.e. invert the black logo whenever (scrolled === isDark).
  const logoOnDarkBackdrop = scrolled === isDark;

  const linkClass = scrolled
    ? "mino-eyebrow text-mino-forest/90 hover:text-mino-forest transition-colors"
    : "mino-eyebrow text-mino-cream/80 hover:text-mino-cream transition-colors";

  const outlineButtonClass = scrolled
    ? "items-center mino-eyebrow text-mino-forest/90 hover:text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-4 py-2.5"
    : "items-center mino-eyebrow text-mino-cream/80 hover:text-mino-cream border border-mino-cream/30 hover:border-mino-cream/60 transition-colors px-4 py-2.5";

  const ctaClass = scrolled
    ? "items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-5 py-2.5"
    : "items-center gap-2 mino-eyebrow text-mino-forest bg-mino-cream hover:bg-mino-bone transition-colors px-5 py-2.5";

  return (
    <nav
      data-testid="nav-main"
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${
        scrolled
          ? "bg-mino-cream/85 backdrop-blur-md border-b border-mino-forest/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[88rem] mx-auto px-6 md:px-12 py-5 md:py-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          data-testid="link-home"
          aria-label="(mino) home"
          className="inline-flex items-center"
        >
          <img
            src={minoLogoBlack}
            alt="(mino)"
            className={`h-7 md:h-8 w-auto select-none transition-[filter] duration-500 ${
              logoOnDarkBackdrop ? "invert brightness-0 contrast-200 opacity-90" : ""
            }`}
            draggable={false}
          />
        </Link>

        <div className="hidden md:flex items-center gap-7 lg:gap-9">
          <a
            href={homeHashHref("positioning")}
            data-testid="link-positioning"
            className={linkClass}
          >
            Positioning
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="trigger-field-guide"
              className={`group inline-flex items-center gap-1.5 outline-none ${linkClass}`}
            >
              Field Guide
              <ChevronDown
                className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={14}
              data-testid="menu-field-guide"
              className="min-w-[14rem] rounded-none border-mino-forest/15 bg-mino-cream/95 backdrop-blur-md p-0 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]"
            >
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Vol. I · Field Guide
                </span>
              </div>
              {FIELD_GUIDE_LINKS.map((link, i) => (
                <DropdownMenuItem
                  key={link.hash}
                  asChild
                  className="px-4 py-3 rounded-none focus:bg-mino-bone/70 focus:text-mino-forest cursor-pointer"
                >
                  <a
                    href={homeHashHref(link.hash)}
                    data-testid={link.testId}
                    className="flex items-baseline justify-between gap-6 w-full"
                  >
                    <span className="font-serif text-lg text-mino-forest">
                      {link.label}
                    </span>
                    <span className="mino-eyebrow text-mino-sage-deep">
                      0{i + 1}
                    </span>
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/catalog"
            data-testid="link-catalog"
            className={linkClass}
          >
            Catalog
          </Link>
          <Link
            href="/learn"
            data-testid="link-learn"
            className={linkClass}
          >
            Learn
          </Link>
          <a
            href={homeHashHref("partners")}
            data-testid="link-partners"
            className={linkClass}
          >
            Partners
          </a>
          <a
            href={homeHashHref("standard")}
            data-testid="link-standard"
            className={linkClass}
          >
            Standard
          </a>
        </div>

        <div className="flex items-center gap-3">
          {!isLoading && !isAuthenticated && (
            <button
              type="button"
              data-testid="button-nav-login"
              onClick={() => setAuthOpen(true)}
              className={`hidden sm:inline-flex ${outlineButtonClass}`}
            >
              Log in
            </button>
          )}

          {!isLoading && isAuthenticated && (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/learn/me"
                data-testid="link-nav-dashboard"
                aria-label="My dashboard"
                title={`${user?.firstName || user?.email || "Account"} — My dashboard`}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-mino-sage-deep/15 text-mino-sage-deep font-serif text-xs uppercase hover:bg-mino-sage-deep/25 transition-colors"
              >
                {(user?.firstName?.[0] ?? user?.email?.[0] ?? "·").toUpperCase()}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid="trigger-account-menu"
                  className={`inline-flex items-center gap-1 outline-none ${linkClass}`}
                >
                  <span className="max-w-[10rem] truncate normal-case tracking-normal font-serif text-sm">
                    {user?.firstName || user?.email || "Account"}
                  </span>
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={14}
                  data-testid="menu-account"
                  className="min-w-[14rem] rounded-none border-mino-forest/15 bg-mino-cream/95 backdrop-blur-md p-0 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]"
                >
                  <div className="px-4 pt-4 pb-2">
                    <span className="mino-eyebrow text-mino-sage-deep block">
                      Signed in
                    </span>
                    <span className="font-serif text-base text-mino-forest block mt-1 truncate">
                      {user?.email ?? "—"}
                    </span>
                  </div>
                  <DropdownMenuSeparator className="bg-mino-forest/10 my-0" />
                  <DropdownMenuItem
                    asChild
                    className="px-4 py-3 rounded-none focus:bg-mino-bone/70 focus:text-mino-forest cursor-pointer"
                  >
                    <Link
                      href="/learn/me"
                      data-testid="menu-link-dashboard"
                      className="w-full text-left mino-eyebrow text-mino-forest"
                    >
                      My dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-mino-forest/10 my-0" />
                  <DropdownMenuItem
                    asChild
                    className="px-4 py-3 rounded-none focus:bg-mino-bone/70 focus:text-mino-forest cursor-pointer"
                  >
                    <Link
                      href="/account"
                      data-testid="link-nav-account"
                      className="w-full text-left mino-eyebrow text-mino-forest"
                    >
                      Account settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-mino-forest/10 my-0" />
                  <DropdownMenuItem
                    asChild
                    className="px-4 py-3 rounded-none focus:bg-mino-bone/70 focus:text-mino-forest cursor-pointer"
                  >
                    <button
                      type="button"
                      data-testid="button-nav-logout"
                      onClick={logout}
                      className="w-full text-left mino-eyebrow text-mino-forest"
                    >
                      Log out
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              data-testid="trigger-mobile-menu"
              aria-label="Open navigation menu"
              className={`md:hidden inline-flex items-center justify-center h-10 w-10 transition-colors border ${
                scrolled
                  ? "text-mino-forest hover:text-mino-ink border-mino-forest/20 hover:border-mino-forest/40"
                  : "text-mino-cream hover:text-mino-cream/80 border-mino-cream/30 hover:border-mino-cream/60"
              }`}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </SheetTrigger>
            <SheetContent
              side="right"
              data-testid="menu-mobile"
              aria-describedby={undefined}
              className="w-full sm:max-w-md bg-mino-cream border-l border-mino-forest/15 p-0 flex flex-col"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>

              <div className="shrink-0 px-6 pt-8 pb-6 flex items-center gap-3 border-b border-mino-forest/10">
                <span className="mino-rule" />
                <span className="mino-eyebrow text-mino-sage-deep">
                  Navigate
                </span>
              </div>

              <div
                data-testid="mobile-menu-scroll"
                className="flex-1 min-h-0 overflow-y-auto"
              >
                <nav className="px-6 py-6 flex flex-col gap-1">
                  {PRIMARY_LINKS.map((item) =>
                    item.to ? (
                      <SheetClose key={item.label} asChild>
                        <Link
                          href={item.to}
                          data-testid={item.testId}
                          className="font-serif text-2xl text-mino-forest py-3 border-b border-mino-forest/10"
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    ) : (
                      <SheetClose key={item.label} asChild>
                        <a
                          href={homeHashHref(item.hash!)}
                          data-testid={item.testId}
                          className="font-serif text-2xl text-mino-forest py-3 border-b border-mino-forest/10"
                        >
                          {item.label}
                        </a>
                      </SheetClose>
                    ),
                  )}
                </nav>

                <div className="px-6 pt-6 pb-3 flex items-center gap-3">
                  <span className="mino-rule" />
                  <span className="mino-eyebrow text-mino-sage-deep">
                    Vol. I · Field Guide
                  </span>
                </div>
                <div className="px-6 pb-8 flex flex-col">
                  {FIELD_GUIDE_LINKS.map((link, i) => (
                    <SheetClose key={link.hash} asChild>
                      <a
                        href={homeHashHref(link.hash)}
                        data-testid={`mobile-${link.testId}`}
                        className="flex items-baseline justify-between gap-6 py-3 border-b border-mino-forest/10"
                      >
                        <span className="font-serif text-xl text-mino-forest">
                          {link.label}
                        </span>
                        <span className="mino-eyebrow text-mino-sage-deep">
                          0{i + 1}
                        </span>
                      </a>
                    </SheetClose>
                  ))}
                </div>
              </div>

              <div className="shrink-0 px-6 pt-5 pb-8 flex flex-col gap-5 border-t border-mino-forest/10 bg-mino-cream">
                <div className="flex items-center justify-between gap-4">
                  <span className="mino-eyebrow text-mino-sage-deep">
                    Theme
                  </span>
                  <ThemeToggle tone="forest" />
                </div>

                {!isLoading && isAuthenticated && (
                  <SheetClose asChild>
                    <Link
                      href="/learn/me"
                      data-testid="mobile-link-dashboard"
                      className="flex items-center justify-between gap-4 -mt-1"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-mino-sage-deep/15 text-mino-sage-deep font-serif text-sm uppercase shrink-0">
                          {(user?.firstName?.[0] ?? user?.email?.[0] ?? "·").toUpperCase()}
                        </span>
                        <span className="font-serif text-mino-forest text-base truncate">
                          {user?.firstName || user?.email || "Account"}
                        </span>
                      </div>
                      <span className="mino-eyebrow text-mino-sage-deep">
                        Dashboard →
                      </span>
                    </Link>
                  </SheetClose>
                )}

                {!isLoading && !isAuthenticated && (
                  <SheetClose asChild>
                    <button
                      type="button"
                      data-testid="mobile-button-login"
                      onClick={() => setAuthOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 hover:text-mino-forest transition-colors px-5 py-4"
                    >
                      Log in
                    </button>
                  </SheetClose>
                )}

                {!isLoading && isAuthenticated && (
                  <SheetClose asChild>
                    <Link
                      href="/account"
                      data-testid="mobile-link-account"
                      className="inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 hover:text-mino-forest transition-colors px-5 py-4"
                    >
                      Account settings
                    </Link>
                  </SheetClose>
                )}

                {!isLoading && isAuthenticated && (
                  <SheetClose asChild>
                    <button
                      type="button"
                      data-testid="mobile-button-logout"
                      onClick={logout}
                      className="inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 hover:text-mino-forest transition-colors px-5 py-4"
                    >
                      Log out
                    </button>
                  </SheetClose>
                )}

              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </nav>
  );
}
