import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cat, ShieldCheck, Zap, Loader2 } from "lucide-react";

/**
 * [💭 Analysis] 
 * Sovereign Login Page - System Revision 3.5.8
 * PATH: client/src/pages/login.tsx
 * FIX: Removed react-icons import that was crashing Vite.
 * FIX: Replaced Replit button with Sovereign Google/Dev buttons.
 */

// Custom Google Icon SVG for dependency-free rendering
const GoogleIcon = () => (
  <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
  </svg>
);

export default function AuthPage() {
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", { method: "POST" });
      if (res.ok) window.location.href = "/";
    } catch (e) {
      console.error("Login failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-950 p-4 font-sans">
      <Card className="w-full max-w-[400px] border-indigo-500 bg-slate-900 text-white shadow-[0_0_50px_rgba(79,70,229,0.4)]">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-full animate-pulse">
              <Cat className="h-10 w-10 text-indigo-400" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Meowstik</CardTitle>
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
             <Zap className="h-3 w-3" />
             <span>SOVEREIGN V3.5.8</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            className="w-full h-12 text-lg font-medium bg-white text-black hover:bg-indigo-100" 
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleIcon />
            Sign in with Google
          </Button>

          <div className="relative">
             <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800" /></div>
             <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-slate-900 px-2 text-slate-500 font-mono">Creator Access</span></div>
          </div>

          <Button 
            className="w-full h-12 text-lg border-indigo-800 hover:bg-indigo-900 text-indigo-300"
            variant="outline"
            onClick={handleDevLogin}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-3 h-5 w-5" />}
            {loading ? "Igniting..." : "Enter as Creator"}
          </Button>
          
          <p className="text-center text-[9px] text-slate-600 font-mono uppercase tracking-widest">
            Sovereign Identity Layer // Replit Purged
          </p>
        </CardContent>
      </Card>
    </div>
  );
}