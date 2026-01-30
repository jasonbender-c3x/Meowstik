import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import logo from "@assets/generated_images/cute_cat_logo_icon.png";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isHomeDevMode, setIsHomeDevMode] = useState(false);

  // Check if HOME_DEV_MODE is enabled via the status endpoint
  useEffect(() => {
    const checkHomeDevMode = async () => {
      try {
        const response = await fetch("/api/status");
        if (response.ok) {
          const data = await response.json();
          if (data.homeDevMode === true) {
            setIsHomeDevMode(true);
          }
        }
      } catch (error) {
        // Normal behavior - not in home dev mode
        setIsHomeDevMode(false);
      }
    };

    if (!isAuthenticated && !isLoading) {
      checkHomeDevMode();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // In home dev mode, redirect immediately to home
  if (isAuthenticated || isHomeDevMode) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="login-page">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Meowstik
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered assistant for productivity and creativity
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full flex flex-col items-center">
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
            <img 
              src={logo} 
              alt="Meowstik Logo" 
              className="w-24 h-24 rounded-2xl relative z-10 shadow-2xl shadow-primary/20" 
              data-testid="img-login-logo" 
            />
          </div>
          
          <h2 className="text-4xl font-display font-bold text-center mb-2" data-testid="text-login-title">
            Welcome to Meowstik
          </h2>
          
          <p className="text-muted-foreground text-center mb-8" data-testid="text-login-subtitle">
            Your AI-powered assistant for productivity and creativity
          </p>
          
          <Button 
            size="lg" 
            className="w-full max-w-xs"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login-replit"
          >
            Sign in with Replit
          </Button>
          
          <p className="text-xs text-muted-foreground text-center mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
