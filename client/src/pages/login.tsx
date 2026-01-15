import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import logo from "@assets/generated_images/cute_cat_logo_icon.png";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isHomeDevMode, setIsHomeDevMode] = useState(false);

  // Check if HOME_DEV_MODE is enabled by checking if we can access /api/auth/user without login
  useEffect(() => {
    const checkHomeDevMode = async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (response.ok) {
          // If we can access the user endpoint without being authenticated through normal flow,
          // we're in home dev mode
          setIsHomeDevMode(true);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
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
        
        <h1 className="text-4xl font-display font-bold text-center mb-2" data-testid="text-login-title">
          Welcome to Meowstik
        </h1>
        
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
  );
}
