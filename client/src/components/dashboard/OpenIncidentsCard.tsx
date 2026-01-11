import { AlertTriangle, Clock, ArrowRight, Flame, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Incident } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface OpenIncidentsCardProps {
  incidents: Incident[];
  isLoading?: boolean;
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case "emergency":
      return { icon: Flame, color: "text-status-busy", bg: "bg-status-busy/10" };
    case "urgent":
      return { icon: AlertTriangle, color: "text-status-away", bg: "bg-status-away/10" };
    default:
      return { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

export function OpenIncidentsCard({ incidents, isLoading }: OpenIncidentsCardProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Open Incidents</CardTitle>
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
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
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">Open Incidents</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {incidents.length}
          </Badge>
        </div>
        <Link href="/incidents">
          <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-all-incidents">
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No open incidents</p>
            <p className="text-xs text-muted-foreground mt-1">All clear!</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {incidents.map((incident) => {
                const config = getSeverityConfig(incident.severity);
                const SeverityIcon = config.icon;
                return (
                  <Link key={incident.id} href={`/incidents/${incident.id}`}>
                    <div
                      className="flex items-start gap-3 p-3 rounded-md hover-elevate cursor-pointer"
                      data-testid={`card-incident-${incident.id}`}
                    >
                      <div className={`h-8 w-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <SeverityIcon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {incident.summary || `${incident.trade} issue`}
                          </p>
                          <Badge variant="outline" size="sm" className="flex-shrink-0">
                            {incident.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {incident.trade && (
                            <span className="capitalize">{incident.trade}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {incident.createdAt ? formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true }) : "Just now"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
