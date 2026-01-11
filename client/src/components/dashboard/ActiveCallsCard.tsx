import { useState, useEffect } from "react";
import { Phone, Bot, User, ArrowRight, PhoneForwarded } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallSession } from "@shared/schema";

interface ActiveCallsCardProps {
  calls: CallSession[];
  isLoading?: boolean;
  onJoinCall?: (callId: string) => void;
  onTransferCall?: (callId: string) => void;
}

function CallTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return <span className="font-mono text-sm">{formatTime(elapsed)}</span>;
}

export function ActiveCallsCard({ calls, isLoading, onJoinCall, onTransferCall }: ActiveCallsCardProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Active Calls</CardTitle>
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg font-medium">Active Calls</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {calls.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No active calls</p>
            <p className="text-xs text-muted-foreground mt-1">Incoming calls will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover-elevate"
                  data-testid={`card-call-${call.id}`}
                >
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {call.aiAnswered ? (
                        <Bot className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-status-online border-2 border-background" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{call.callerNumber}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CallTimer startTime={call.startTime} />
                      <span>|</span>
                      <Badge variant="outline" size="sm">
                        {call.state}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => onJoinCall?.(call.id)}
                      data-testid={`button-join-call-${call.id}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => onTransferCall?.(call.id)}
                      data-testid={`button-transfer-call-${call.id}`}
                    >
                      <PhoneForwarded className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
