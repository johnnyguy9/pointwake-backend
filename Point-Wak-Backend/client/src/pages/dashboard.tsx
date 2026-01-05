import { useQuery } from "@tanstack/react-query";
import { Phone, AlertTriangle, Bot, Clock, Truck, PhoneCall } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActiveCallsCard } from "@/components/dashboard/ActiveCallsCard";
import { OpenIncidentsCard } from "@/components/dashboard/OpenIncidentsCard";
import { TeamAvailabilityCard } from "@/components/dashboard/TeamAvailabilityCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { SoftPhone } from "@/components/SoftPhone";
import type { CallSession, Incident, User } from "@shared/schema";
import type { DashboardStats, ActivityItem } from "@/lib/types";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activeCalls = [], isLoading: callsLoading } = useQuery<CallSession[]>({
    queryKey: ["/api/calls/active"],
  });

  const { data: openIncidents = [], isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents", { status: "open" }],
  });

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity/recent"],
  });

  const handleJoinCall = (callId: string) => {
    console.log("Joining call:", callId);
  };

  const handleTransferCall = (callId: string) => {
    console.log("Transferring call:", callId);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor your call operations in real-time</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Calls Today"
          value={stats?.callsToday ?? 0}
          subtitle="from all sources"
          icon={PhoneCall}
          isLoading={statsLoading}
        />
        <StatsCard
          title="Active Calls"
          value={stats?.activeCalls ?? 0}
          subtitle="currently in progress"
          icon={Phone}
          isLoading={statsLoading}
        />
        <StatsCard
          title="AI Handled"
          value={stats?.aiHandledPercent ? `${stats.aiHandledPercent}%` : "0%"}
          subtitle="of total calls"
          icon={Bot}
          trend={{ value: 12, isPositive: true }}
          isLoading={statsLoading}
        />
        <StatsCard
          title="Open Incidents"
          value={stats?.openIncidents ?? 0}
          subtitle="requiring attention"
          icon={AlertTriangle}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActiveCallsCard
          calls={activeCalls}
          isLoading={callsLoading}
          onJoinCall={handleJoinCall}
          onTransferCall={handleTransferCall}
        />
        <OpenIncidentsCard
          incidents={openIncidents}
          isLoading={incidentsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TeamAvailabilityCard
          users={teamMembers}
          isLoading={teamLoading}
        />
        <RecentActivityCard
          activities={activities}
          isLoading={activitiesLoading}
        />
      </div>

      {/* Floating SoftPhone for receiving transferred calls */}
      <div className="fixed bottom-6 right-6 z-50">
        <SoftPhone />
      </div>
    </div>
  );
}
