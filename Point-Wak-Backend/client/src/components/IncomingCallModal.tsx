import { useEffect, useState } from "react";
import { Phone, PhoneOff, User, Building2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IncomingCall } from "@/lib/types";

interface IncomingCallModalProps {
  call: IncomingCall | null;
  onAnswer: (callId: string) => void;
  onDecline: (callId: string) => void;
}

export function IncomingCallModal({ call, onAnswer, onDecline }: IncomingCallModalProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!call) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - call.startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [call]);

  useEffect(() => {
    if (!call) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        onAnswer(call.id);
      } else if (e.code === "Escape") {
        e.preventDefault();
        onDecline(call.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [call, onAnswer, onDecline]);

  if (!call) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative rounded-full bg-primary h-20 w-20 flex items-center justify-center">
                <Phone className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Incoming Call</h2>
              <p className="text-lg font-mono" data-testid="text-caller-number">{call.callerNumber}</p>
              {call.callerName && (
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                  <User className="h-4 w-4" />
                  {call.callerName}
                </p>
              )}
            </div>

            {(call.propertyName || call.unitNumber) && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>
                  {call.propertyName}
                  {call.unitNumber && ` - Unit ${call.unitNumber}`}
                </span>
              </div>
            )}

            {call.isAiHandled && (
              <div className="space-y-2">
                <Badge variant="secondary" className="gap-1">
                  <Bot className="h-3 w-3" />
                  AI Handled
                </Badge>
                {call.aiContext && (
                  <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                    {call.aiContext}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground font-mono">
              Ringing for {formatTime(elapsed)}
            </p>

            <div className="flex gap-4 justify-center pt-4">
              <Button
                variant="destructive"
                size="lg"
                className="gap-2 min-w-[120px]"
                onClick={() => onDecline(call.id)}
                data-testid="button-decline-call"
              >
                <PhoneOff className="h-5 w-5" />
                Decline
              </Button>
              <Button
                size="lg"
                className="gap-2 min-w-[120px] bg-status-online text-white"
                onClick={() => onAnswer(call.id)}
                data-testid="button-answer-call"
              >
                <Phone className="h-5 w-5" />
                Answer
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Space</kbd> to answer or <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Esc</kbd> to decline
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
