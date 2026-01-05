import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  Building2, 
  Wrench,
  Flame,
  AlertCircle,
  CheckCircle,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Incident } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

function getSeverityConfig(severity: string) {
  switch (severity) {
    case "emergency":
      return { icon: Flame, color: "text-status-busy", bg: "bg-status-busy/10", variant: "destructive" as const };
    case "urgent":
      return { icon: AlertTriangle, color: "text-status-away", bg: "bg-status-away/10", variant: "secondary" as const };
    case "normal":
      return { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted", variant: "outline" as const };
    default:
      return { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted", variant: "outline" as const };
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case "open":
      return { variant: "secondary" as const, label: "Open" };
    case "dispatched":
      return { variant: "default" as const, label: "Dispatched" };
    case "in_progress":
      return { variant: "default" as const, label: "In Progress" };
    case "resolved":
      return { variant: "outline" as const, label: "Resolved" };
    case "escalated":
      return { variant: "destructive" as const, label: "Escalated" };
    default:
      return { variant: "outline" as const, label: status };
  }
}

export default function IncidentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch = 
      incident.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.trade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.callerPhone?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const openCount = incidents.filter(i => i.status === "open").length;
  const dispatchedCount = incidents.filter(i => i.status === "dispatched").length;
  const escalatedCount = incidents.filter(i => i.status === "escalated").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-muted-foreground mt-1">Manage and track service requests</p>
        </div>
        <Button className="gap-2" data-testid="button-create-incident">
          <Plus className="h-4 w-4" />
          New Incident
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-semibold" data-testid="stat-open-incidents">{openCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-status-away/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-status-away" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dispatched</p>
                <p className="text-2xl font-semibold" data-testid="stat-dispatched-incidents">{dispatchedCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escalated</p>
                <p className="text-2xl font-semibold" data-testid="stat-escalated-incidents">{escalatedCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-status-busy/10 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-status-busy" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-incidents"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No incidents found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search or filters" : "Incidents will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const sevConfig = getSeverityConfig(incident.severity);
                    const statusConfig = getStatusConfig(incident.status);
                    const SeverityIcon = sevConfig.icon;
                    return (
                      <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                        <TableCell>
                          <div className={`h-8 w-8 rounded-full ${sevConfig.bg} flex items-center justify-center`}>
                            <SeverityIcon className={`h-4 w-4 ${sevConfig.color}`} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium truncate">{incident.summary || "No summary"}</p>
                            {incident.callerPhone && (
                              <p className="text-xs text-muted-foreground font-mono">{incident.callerPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">{incident.trade || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant} size="sm">
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {incident.createdAt 
                            ? formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/incidents/${incident.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-incident-${incident.id}`}>
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
