/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           APP.TSX - ROOT APPLICATION                          ║
 * ║                                                                               ║
 * ║  This is the main application component that serves as the entry point       ║
 * ║  for the React application. It sets up:                                      ║
 * ║  - Global providers (authentication, theme, etc.)                            ║
 * ║  - The main application layout                                               ║
 * ║  - Client-side routing using React Router                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import MainLayout from "@/pages/MainLayout";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <SocketProvider>
            <AuthProvider>
              <ChatProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/*" element={<MainLayout />} />
                </Routes>
                <Toaster />
              </ChatProvider>
            </AuthProvider>
          </SocketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
