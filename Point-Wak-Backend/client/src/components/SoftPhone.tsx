/**
 * SoftPhone Component
 * 
 * Provides a complete in-browser phone interface for staff to receive
 * transferred calls via Twilio Client (WebRTC). No personal phone numbers needed.
 */

import { useState, useEffect } from "react";
import { 
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff, 
  Volume2, VolumeX, User, Clock, Wifi, WifiOff,
  AlertCircle, CheckCircle, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTwilioClient, formatDuration } from "@/hooks/useTwilioClient";
import { useWebSocket } from "@/context/WebSocketContext";
import { cn } from "@/lib/utils";

interface SoftPhoneProps {
  className?: string;
  compact?: boolean;
}

export function SoftPhone({ className, compact = false }: SoftPhoneProps) {
  const {
    isRegistered,
    isRegistering,
    error,
    callState,
    register,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
  } = useTwilioClient({
    onIncomingCall: (call) => {
      // Play ringtone
      playRingtone();
      // Browser notification
      showNotification("Incoming Call", call.parameters.From || "Unknown");
    },
    onCallAccepted: () => {
      stopRingtone();
    },
    onCallDisconnected: () => {
      stopRingtone();
    },
    onError: (err) => {
      console.error("Twilio error:", err);
    },
  });

  const { lastMessage, isConnected: wsConnected } = useWebSocket();
  const [transferContext, setTransferContext] = useState<{
    reason?: string;
    urgency?: string;
    callerName?: string;
  } | null>(null);

  // Handle WebSocket messages for transfer context
  useEffect(() => {
    if (lastMessage?.type === "incoming_transfer") {
      const payload = lastMessage.payload as any;
      setTransferContext({
        reason: payload.reason,
        urgency: payload.urgency,
        callerName: payload.callerName,
      });
    }
    if (lastMessage?.type === "call_ended") {
      setTransferContext(null);
    }
  }, [lastMessage]);

  // Audio elements for ringtone
  const playRingtone = () => {
    // Could use actual audio file here
    if ("Notification" in window && Notification.permission === "granted") {
      // Notification handles the alert
    }
  };

  const stopRingtone = () => {
    // Stop audio
  };

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.png" });
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Compact version for header/sidebar
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {isRegistered ? (
            <span className="flex items-center gap-1 text-xs text-status-online">
              <span className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
              Online
            </span>
          ) : isRegistering ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-status-offline">
              <span className="w-2 h-2 rounded-full bg-status-offline" />
              Offline
            </span>
          )}
        </div>

        {/* Incoming call indicator */}
        {callState.isIncoming && (
          <Badge variant="destructive" className="animate-pulse gap-1">
            <PhoneIncoming className="h-3 w-3" />
            Incoming
          </Badge>
        )}

        {/* Active call indicator */}
        {callState.isActive && (
          <Badge variant="secondary" className="gap-1">
            <Phone className="h-3 w-3" />
            {formatDuration(callState.duration)}
          </Badge>
        )}

        {/* Register button if offline */}
        {!isRegistered && !isRegistering && (
          <Button size="sm" variant="outline" onClick={register}>
            Go Online
          </Button>
        )}
      </div>
    );
  }

  // Full softphone panel
  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Softphone
          </span>
          <StatusIndicator 
            isRegistered={isRegistered} 
            isRegistering={isRegistering}
            wsConnected={wsConnected}
          />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Registration status */}
        {!isRegistered && (
          <div className="text-center py-4">
            {isRegistering ? (
              <div className="space-y-2">
                <div className="animate-spin h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground">Connecting to phone system...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Go online to receive incoming calls
                </p>
                <Button onClick={register} className="gap-2">
                  <Phone className="h-4 w-4" />
                  Go Online
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Incoming call UI */}
        {isRegistered && callState.isIncoming && !callState.isActive && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative rounded-full bg-primary h-16 w-16 flex items-center justify-center">
                  <PhoneIncoming className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <h3 className="font-semibold">Incoming Call</h3>
              <p className="font-mono text-lg">{callState.callerNumber}</p>
              
              {transferContext && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {transferContext.callerName && (
                    <p className="flex items-center justify-center gap-1">
                      <User className="h-3 w-3" />
                      {transferContext.callerName}
                    </p>
                  )}
                  {transferContext.reason && (
                    <p className="italic">"{transferContext.reason}"</p>
                  )}
                  {transferContext.urgency && (
                    <Badge variant={transferContext.urgency === "emergency" ? "destructive" : "secondary"}>
                      {transferContext.urgency}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="destructive"
                size="lg"
                onClick={rejectCall}
                className="gap-2"
              >
                <PhoneOff className="h-5 w-5" />
                Decline
              </Button>
              <Button
                size="lg"
                onClick={answerCall}
                className="gap-2 bg-status-online hover:bg-status-online/90"
              >
                <Phone className="h-5 w-5" />
                Answer
              </Button>
            </div>
          </div>
        )}

        {/* Active call UI */}
        {isRegistered && callState.isActive && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="rounded-full bg-status-online/10 h-16 w-16 mx-auto flex items-center justify-center">
                <Phone className="h-6 w-6 text-status-online" />
              </div>
              <h3 className="font-semibold">On Call</h3>
              <p className="font-mono text-lg">{callState.callerNumber}</p>
              <p className="font-mono text-2xl flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {formatDuration(callState.duration)}
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant={callState.isMuted ? "default" : "outline"}
                size="icon"
                onClick={toggleMute}
                className="h-12 w-12"
              >
                {callState.isMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={hangUp}
                className="gap-2 px-8"
              >
                <PhoneOff className="h-5 w-5" />
                End Call
              </Button>
            </div>
          </div>
        )}

        {/* Idle state */}
        {isRegistered && !callState.isIncoming && !callState.isActive && (
          <div className="text-center py-4 space-y-2">
            <div className="rounded-full bg-muted h-16 w-16 mx-auto flex items-center justify-center">
              <Phone className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ready to receive calls
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ 
  isRegistered, 
  isRegistering, 
  wsConnected 
}: { 
  isRegistered: boolean; 
  isRegistering: boolean; 
  wsConnected: boolean;
}) {
  if (isRegistering) {
    return (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        Connecting
      </Badge>
    );
  }
  
  if (isRegistered) {
    return (
      <Badge variant="outline" className="gap-1 text-status-online border-status-online">
        <div className="h-2 w-2 rounded-full bg-status-online" />
        Online
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="gap-1 text-status-offline border-status-offline">
      <div className="h-2 w-2 rounded-full bg-status-offline" />
      Offline
    </Badge>
  );
}

export default SoftPhone;
