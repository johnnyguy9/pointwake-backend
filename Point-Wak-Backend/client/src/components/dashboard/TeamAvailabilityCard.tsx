import { Users, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@shared/schema";

interface TeamAvailabilityCardProps {
  users: User[];
  isLoading?: boolean;
}

function getAvailabilityStyles(availability: string) {
  switch (availability) {
    case "available":
      return { dot: "bg-status-online", label: "Available" };
    case "busy":
      return { dot: "bg-status-busy", label: "Busy" };
    default:
      return { dot: "bg-status-offline", label: "Offline" };
  }
}

export function TeamAvailabilityCard({ users, isLoading }: TeamAvailabilityCardProps) {
  const availableCount = users.filter((u) => u.availability === "available").length;
  const busyCount = users.filter((u) => u.availability === "busy").length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Team Availability</CardTitle>
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-3.5 w-16 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">Team Availability</CardTitle>
          <Badge variant="outline" className="text-xs gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-status-online" />
            {availableCount} online
          </Badge>
        </div>
        {busyCount > 0 && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Phone className="h-3 w-3" />
            {busyCount} on call
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No team members</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {users.map((user) => {
              const styles = getAvailabilityStyles(user.availability);
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover-elevate"
                  data-testid={`user-status-${user.id}`}
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${styles.dot} border-2 border-background`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
