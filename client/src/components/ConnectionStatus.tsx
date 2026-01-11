import { Wifi, WifiOff } from "lucide-react";
import { useWebSocket } from "@/context/WebSocketContext";

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  if (isConnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-1 px-4 text-center text-sm flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>Connection lost. Reconnecting...</span>
    </div>
  );
}
