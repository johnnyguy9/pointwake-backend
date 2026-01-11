import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { 
  ArrowLeft, 
  Clock, 
  Building2, 
  Phone, 
  User, 
  Wrench, 
  Truck,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DispatchPanel } from "@/components/DispatchPanel";
import type { Incident, Property, Vendor } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

function getSeverityConfig(severity: string) {
  switch (severity) {
    case "emergency":
      return { label: "Emergency", variant: "destructive" as const };
    case "urgent":
      return { label: "Urgent", variant: "secondary" as const };
    default:
      return { label: "Normal", variant: "outline" as const };
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case "open":
      return { label: "Open", variant: "secondary" as const };
    case "dispatched":
      return { label: "Dispatched", variant: "default" as const };
    case "in_progress":
      return { label: "In Progress", variant: "default" as const };
    case "resolved":
      return { label: "Resolved", variant: "outline" as const };
    case "escalated":
      return { label: "Escalated", variant: "destructive" as const };
    default:
      return { label: status, variant: "outline" as const };
  }
}

export default function IncidentDetailPage() {
  const [, params] = useRoute("/incidents/:id");
  const incidentId = params?.id;
  const { toast } = useToast();

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", incidentId],
    enabled: !!incidentId,
  });

  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", incident?.propertyId],
    enabled: !!incident?.propertyId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/incidents/${incidentId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Incident not found</p>
          <Link href="/incidents">
            <Button variant="outline" className="mt-4">Back to Incidents</Button>
          </Link>
        </div>
      </div>
    );
  }

  const sevConfig = getSeverityConfig(incident.severity);
  const statusConfig = getStatusConfig(incident.status);
  const auditLog = (incident.auditLog as { timestamp: string; action: string; details?: string }[] | null) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/incidents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Incident</h1>
              <span className="text-muted-foreground font-mono text-sm">#{incident.id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={sevConfig.variant} size="sm">{sevConfig.label}</Badge>
              <Badge variant={statusConfig.variant} size="sm">{statusConfig.label}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {incident.status !== "resolved" && (
            <>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => updateStatusMutation.mutate("dispatched")}
                disabled={updateStatusMutation.isPending}
                data-testid="button-dispatch-incident"
              >
                <Truck className="h-4 w-4" />
                Dispatch
              </Button>
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => updateStatusMutation.mutate("escalated")}
                disabled={updateStatusMutation.isPending}
                data-testid="button-escalate-incident"
              >
                <ArrowUpRight className="h-4 w-4" />
                Escalate
              </Button>
              <Button 
                className="gap-2"
                onClick={() => updateStatusMutation.mutate("resolved")}
                disabled={updateStatusMutation.isPending}
                data-testid="button-resolve-incident"
              >
                <CheckCircle className="h-4 w-4" />
                Resolve
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Summary</p>
                <p className="font-medium">{incident.summary || "No summary provided"}</p>
              </div>
              {incident.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{incident.description}</p>
                </div>
              )}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trade</p>
                    <p className="text-sm font-medium capitalize">{incident.trade || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">
                      {incident.createdAt ? format(new Date(incident.createdAt), "MMM d, yyyy h:mm a") : "-"}
                    </p>
                  </div>
                </div>
                {incident.callerPhone && (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Caller</p>
                      <p className="text-sm font-medium font-mono">{incident.callerPhone}</p>
                    </div>
                  </div>
                )}
                {property && (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="text-sm font-medium">{property.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {incident.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Call Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-md p-4 text-sm whitespace-pre-wrap font-mono">
                  {incident.transcript}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {incident.status !== "resolved" && (
            <DispatchPanel 
              incident={incident} 
              onDispatchSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/incidents", incidentId] })}
            />
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {auditLog.map((entry, index) => (
                        <div key={index} className="flex gap-3 relative">
                          <div className="relative z-10 h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm font-medium">{entry.action}</p>
                            {entry.details && (
                              <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
