import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

const availabilityOptions = [
  { value: "available", label: "Available", icon: Check, color: "text-status-online" },
  { value: "busy", label: "Busy", icon: Clock, color: "text-status-busy" },
  { value: "offline", label: "Offline", icon: X, color: "text-status-offline" },
] as const;

export function AvailabilityToggle() {
  const { user, setAvailability } = useAuth();

  if (!user) return null;

  const currentStatus = availabilityOptions.find((opt) => opt.value === user.availability) || availabilityOptions[2];
  const StatusIcon = currentStatus.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-availability-toggle">
          <div className={`h-2 w-2 rounded-full ${
            currentStatus.value === "available" ? "bg-status-online" :
            currentStatus.value === "busy" ? "bg-status-busy" : "bg-status-offline"
          }`} />
          <span className="text-sm">{currentStatus.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availabilityOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setAvailability(option.value)}
              data-testid={`menu-availability-${option.value}`}
            >
              <div className={`h-2 w-2 rounded-full mr-2 ${
                option.value === "available" ? "bg-status-online" :
                option.value === "busy" ? "bg-status-busy" : "bg-status-offline"
              }`} />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
