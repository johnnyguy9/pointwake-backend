import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ ACCOUNT TIERS & STATUSES ============
export const AccountTiers = {
  FREE: "free",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;

export type AccountTier = typeof AccountTiers[keyof typeof AccountTiers];

export const AccountStatuses = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  TRIAL: "trial",
} as const;

export type AccountStatus = typeof AccountStatuses[keyof typeof AccountStatuses];

// ============ USER ROLES ============
export const UserRoles = {
  SUPER_ADMIN: "super_admin",
  ACCOUNT_ADMIN: "account_admin",
  MANAGER: "manager",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type UserRole = typeof UserRoles[keyof typeof UserRoles];

// ============ ACCOUNT ============
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("professional"),
  status: text("status").notNull().default("active"),
  mainPhoneNumber: text("main_phone_number"),
  stripeCustomerId: text("stripe_customer_id"),
  billingPlan: text("billing_plan").notNull().default("standard"),
  baseFeePerLocation: real("base_fee_per_location").notNull().default(99.0),
  aiRatePerMinute: real("ai_rate_per_minute").notNull().default(0.15),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// ============ LOCATION ============
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  spokenAliases: text("spoken_aliases").array(),
  routingStrategy: text("routing_strategy").notNull().default("simultaneous"),
  businessHoursStart: text("business_hours_start").default("09:00"),
  businessHoursEnd: text("business_hours_end").default("17:00"),
  afterHoursPolicy: text("after_hours_policy").default("voicemail"),
  timezone: text("timezone").default("America/New_York"),
});

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// ============ USER ============
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id"),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name"),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  availability: text("availability").notNull().default("offline"),
  appEndpoint: text("app_endpoint"),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============ PROPERTY ============
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  locationId: varchar("location_id"),
  name: text("name").notNull(),
  address: text("address").notNull(),
  primaryPhone: text("primary_phone"),
  emergencyPolicyId: varchar("emergency_policy_id"),
  preferredVendorsByTrade: jsonb("preferred_vendors_by_trade").$type<Record<string, string[]>>(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// ============ UNIT ============
export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  unitNumber: text("unit_number").notNull(),
  notes: text("notes"),
  accessCodes: text("access_codes"),
  equipmentInfo: text("equipment_info"),
});

export const insertUnitSchema = createInsertSchema(units).omit({ id: true });
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Unit = typeof units.$inferSelect;

// ============ VENDOR ============
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trade: text("trade").notNull(),
  coverageAreas: text("coverage_areas").array(),
  priorityRank: integer("priority_rank").notNull().default(1),
  afterHoursAvailable: boolean("after_hours_available").notNull().default(false),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactSms: text("contact_sms"),
  backupVendorIds: text("backup_vendor_ids").array(),
  notes: text("notes"),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

// ============ ESCALATION POLICY ============
export const escalationPolicies = pgTable("escalation_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rules: jsonb("rules").$type<{
    timeWindows?: { start: string; end: string; action: string }[];
    emergencyDefinitions?: string[];
    spendThreshold?: number;
  }>(),
  escalationLadder: jsonb("escalation_ladder").$type<{
    steps: { type: string; targetId?: string; delay?: number }[];
  }>(),
  retryIntervals: integer("retry_intervals").default(300),
  maxAttempts: integer("max_attempts").default(3),
  wakeHumanConditions: text("wake_human_conditions").array(),
});

export const insertEscalationPolicySchema = createInsertSchema(escalationPolicies).omit({ id: true });
export type InsertEscalationPolicy = z.infer<typeof insertEscalationPolicySchema>;
export type EscalationPolicy = typeof escalationPolicies.$inferSelect;

// ============ INCIDENT / TICKET ============
export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id"),
  unitId: varchar("unit_id"),
  trade: text("trade"),
  severity: text("severity").notNull().default("normal"),
  callerPhone: text("caller_phone"),
  callerName: text("caller_name"),
  summary: text("summary"),
  description: text("description"),
  status: text("status").notNull().default("open"),
  assignedUserId: varchar("assigned_user_id"),
  assignedVendorId: varchar("assigned_vendor_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  transcript: text("transcript"),
  auditLog: jsonb("audit_log").$type<{ timestamp: string; action: string; details?: string }[]>(),
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// ============ CALL SESSION ============
export const callSessions = pgTable("call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  callerNumber: text("caller_number").notNull(),
  aiAnswered: boolean("ai_answered").notNull().default(true),
  intent: text("intent"),
  propertyId: varchar("property_id"),
  unitId: varchar("unit_id"),
  trade: text("trade"),
  severity: text("severity"),
  incidentId: varchar("incident_id"),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  totalMinutes: real("total_minutes").default(0),
  aiMinutes: real("ai_minutes").default(0),
  outcome: text("outcome"),
  billableAmount: real("billable_amount").default(0),
  state: text("state").notNull().default("INBOUND_RECEIVED"),
  transcript: text("transcript"),
});

export const insertCallSessionSchema = createInsertSchema(callSessions).omit({ id: true, startTime: true });
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessions.$inferSelect;

// ============ USAGE RECORD ============
export const usageRecords = pgTable("usage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  locationId: varchar("location_id"),
  period: text("period").notNull(),
  totalMinutes: real("total_minutes").default(0),
  aiMinutes: real("ai_minutes").default(0),
  incidentsHandled: integer("incidents_handled").default(0),
  dispatchActions: integer("dispatch_actions").default(0),
  totalCalls: integer("total_calls").default(0),
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({ id: true });
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;

// ============ CALL STATES ============
export const CallStates = {
  INBOUND_RECEIVED: "INBOUND_RECEIVED",
  AI_GREETING: "AI_GREETING",
  AI_INTENT_DETECTION: "AI_INTENT_DETECTION",
  AI_PROPERTY_UNIT_RESOLUTION: "AI_PROPERTY_UNIT_RESOLUTION",
  AI_INFORMATION_COLLECTION: "AI_INFORMATION_COLLECTION",
  AI_ACTION_EXECUTION: "AI_ACTION_EXECUTION",
  ROUTING_TO_HUMAN: "ROUTING_TO_HUMAN",
  RINGING_USERS: "RINGING_USERS",
  QUEUE: "QUEUE",
  CONNECTED: "CONNECTED",
  FALLBACK: "FALLBACK",
  ESCALATION: "ESCALATION",
  ENDED: "ENDED",
} as const;

export type CallState = typeof CallStates[keyof typeof CallStates];

// ============ TRADES ============
export const Trades = {
  HVAC: "hvac",
  PLUMBING: "plumbing",
  ELECTRICAL: "electrical",
  APPLIANCE: "appliance",
  ROOFING: "roofing",
  GENERAL: "general",
  LOCKSMITH: "locksmith",
  PEST_CONTROL: "pest_control",
  LANDSCAPING: "landscaping",
  APPLIANCE_REPAIR: "appliance_repair",
  GENERAL_MAINTENANCE: "general_maintenance",
  PAINTING: "painting",
} as const;

export type Trade = typeof Trades[keyof typeof Trades];

// ============ SEVERITY LEVELS ============
export const SeverityLevels = {
  EMERGENCY: "emergency",
  URGENT: "urgent",
  NORMAL: "normal",
  LOW: "low",
} as const;

export type Severity = typeof SeverityLevels[keyof typeof SeverityLevels];

// ============ INCIDENT STATUSES ============
export const IncidentStatuses = {
  OPEN: "open",
  DISPATCHED: "dispatched",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  ESCALATED: "escalated",
  CANCELLED: "cancelled",
} as const;

export type IncidentStatus = typeof IncidentStatuses[keyof typeof IncidentStatuses];

// ============ USER AVAILABILITY ============
export const UserAvailability = {
  AVAILABLE: "available",
  BUSY: "busy",
  OFFLINE: "offline",
} as const;

export type UserAvailabilityType = typeof UserAvailability[keyof typeof UserAvailability];
