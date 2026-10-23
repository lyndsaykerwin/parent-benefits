import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Component, ErrorInfo, ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Onboarding from "@/pages/Onboarding";
import Feed from "@/pages/Feed";
import CardDetail from "@/pages/CardDetail";
import Smarter from "@/pages/Smarter";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold mb-4 text-ink">Something went wrong</h1>
            <button
              className="min-h-[48px] bg-ink text-cream px-5 rounded-2xl font-bold"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Onboarding} />
      <Route path="/feed/:runId" component={Feed} />
      <Route path="/card/:id" component={CardDetail} />
      <Route path="/smarter" component={Smarter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
