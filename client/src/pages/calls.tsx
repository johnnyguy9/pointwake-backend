import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Bot, User, Play, Download, Filter, Search, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallSession } from "@shared/schema";
import { format } from "date-fns";

export default function CallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [handlerFilter, setHandlerFilter] = useState<string>("all");

  const { data: calls = [], isLoading } = useQuery<CallSession[]>({
    queryKey: ["/api/calls"],
  });

  const filteredCalls = calls.filter((call) => {
    const matchesSearch = call.callerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.intent?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOutcome = outcomeFilter === "all" || call.outcome === outcomeFilter;
    const matchesHandler = handlerFilter === "all" ||
      (handlerFilter === "ai" && call.aiAnswered) ||
      (handlerFilter === "human" && !call.aiAnswered);
    return matchesSearch && matchesOutcome && matchesHandler;
  });

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0:00";
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Call Log</h1>
          <p className="text-muted-foreground mt-1">View and analyze call history</p>
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-export-calls">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number or intent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-calls"
              />
            </div>
            <div className="flex gap-2">
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-outcome-filter">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="resolved_by_ai">AI Resolved</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                </SelectContent>
              </Select>
              <Select value={handlerFilter} onValueChange={setHandlerFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-handler-filter">
                  <SelectValue placeholder="Handler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Handlers</SelectItem>
                  <SelectItem value="ai">AI Only</SelectItem>
                  <SelectItem value="human">Human Only</SelectItem>
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
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No calls found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search or filters" : "Call history will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Handler</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow key={call.id} data-testid={`row-call-${call.id}`}>
                      <TableCell>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {call.aiAnswered ? (
                            <Bot className="h-4 w-4 text-primary" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{call.callerNumber}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {call.startTime ? format(new Date(call.startTime), "MMM d, h:mm a") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(call.totalMinutes)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{call.intent || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" size="sm">
                          {call.outcome?.replace(/_/g, " ") || call.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" data-testid={`button-play-call-${call.id}`}>
                          <Play className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
