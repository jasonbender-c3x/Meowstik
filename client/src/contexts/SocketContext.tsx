import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SocketContextValue {
  isConnected: boolean;
  socket: WebSocket | null;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        setSocket(ws);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        setSocket(null);
      };
      
      ws.onerror = () => {
        setIsConnected(false);
      };
      
      return () => {
        ws.close();
      };
    } catch {
      console.warn("WebSocket connection failed");
    }
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, socket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
}
