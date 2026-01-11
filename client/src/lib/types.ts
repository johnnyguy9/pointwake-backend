import type { 
  Account, 
  Location, 
  User, 
  Property, 
  Unit, 
  Vendor, 
  EscalationPolicy, 
  Incident, 
  CallSession,
  UsageRecord 
} from "@shared/schema";

// Re-export schema types for frontend convenience
export type {
  Account,
  Location,
  User,
  Property,
  Unit,
  Vendor,
  EscalationPolicy,
  Incident,
  CallSession,
  UsageRecord,
};

// Frontend-specific types
export interface IncomingCall {
  id: string;
  callerNumber: string;
  callerName?: string;
  propertyName?: string;
  unitNumber?: string;
  aiContext?: string;
  startTime: Date;
  isAiHandled: boolean;
}

export interface DashboardStats {
  activeCalls: number;
  openIncidents: number;
  aiHandledPercent: number;
  avgHandleTime: number;
  dispatchesToday: number;
  callsToday: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  availability: "available" | "busy" | "offline";
  currentCall?: string;
}

export interface ActivityItem {
  id: string;
  type: "call" | "incident" | "dispatch" | "escalation";
  title: string;
  description: string;
  timestamp: Date;
  severity?: string;
}

export interface BillingEstimate {
  accountId: string;
  period: string;
  locationCount: number;
  baseCharges: number;
  aiMinutes: number;
  aiCharges: number;
  totalEstimate: number;
}
