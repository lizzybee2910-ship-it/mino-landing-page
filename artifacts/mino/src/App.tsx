import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Catalog from "@/pages/catalog";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AccountPage from "@/pages/account";
import LearnCatalogPage from "@/pages/learn-catalog";
import LearnDashboardPage from "@/pages/learn-dashboard";
import LearnCoursePage from "@/pages/learn-course";
import LearnCourseAdminHandoutsPage from "@/pages/learn-course-admin-handouts";
import LearnLessonPage from "@/pages/learn-lesson";
import VerifyCertificatePage from "@/pages/verify-certificate";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { RequireAuth } from "@/components/require-auth";
import { ThemeProvider } from "@/hooks/use-theme";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/account">
        <RequireAuth>
          <AccountPage />
        </RequireAuth>
      </Route>
      <Route path="/learn">
        <RequireAuth>
          <LearnCatalogPage />
        </RequireAuth>
      </Route>
      <Route path="/learn/me">
        <RequireAuth>
          <LearnDashboardPage />
        </RequireAuth>
      </Route>
      <Route path="/learn/:courseSlug">
        {(params) => (
          <RequireAuth>
            <LearnCoursePage params={params} />
          </RequireAuth>
        )}
      </Route>
      <Route path="/learn/:courseSlug/admin/handouts">
        {(params) => (
          <RequireAuth>
            <LearnCourseAdminHandoutsPage params={params} />
          </RequireAuth>
        )}
      </Route>
      <Route path="/learn/:courseSlug/:lessonSlug">
        {(params) => (
          <RequireAuth>
            <LearnLessonPage params={params} />
          </RequireAuth>
        )}
      </Route>
      <Route path="/verify/:certificateId">
        {(params) => <VerifyCertificatePage params={params} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Nav />
            <Router />
            <Footer />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
