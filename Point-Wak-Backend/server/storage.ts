import { eq, and, desc, ilike, or } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcrypt";
import {
  accounts, locations, users, properties, units, vendors,
  escalationPolicies, incidents, callSessions, usageRecords,
  type Account, type InsertAccount,
  type Location, type InsertLocation,
  type User, type InsertUser,
  type Property, type InsertProperty,
  type Unit, type InsertUnit,
  type Vendor, type InsertVendor,
  type EscalationPolicy, type InsertEscalationPolicy,
  type Incident, type InsertIncident,
  type CallSession, type InsertCallSession,
  type UsageRecord, type InsertUsageRecord,
  UserRoles,
} from "@shared/schema";

export interface IStorage {
  getAccount(id: string): Promise<Account | undefined>;
  getAccounts(): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, data: Partial<Account>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<void>;

  getLocation(id: string): Promise<Location | undefined>;
  getLocations(accountId?: string): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, data: Partial<Location>): Promise<Location | undefined>;

  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(accountId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getProperty(id: string): Promise<Property | undefined>;
  getProperties(accountId?: string): Promise<Property[]>;
  searchProperty(query: string, accountId: string): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;

  getUnit(id: string): Promise<Unit | undefined>;
  getUnits(propertyId?: string): Promise<Unit[]>;
  getUnitsForAccount(accountId: string): Promise<Unit[]>;
  getUnitByNumber(propertyId: string, unitNumber: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, data: Partial<Unit>): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<void>;

  getVendor(id: string): Promise<Vendor | undefined>;
  getVendors(accountId?: string): Promise<Vendor[]>;
  getVendorsByTrade(trade: string, accountId: string): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, data: Partial<Vendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<void>;

  getEscalationPolicy(id: string): Promise<EscalationPolicy | undefined>;
  getEscalationPolicies(accountId?: string): Promise<EscalationPolicy[]>;
  createEscalationPolicy(policy: InsertEscalationPolicy): Promise<EscalationPolicy>;
  updateEscalationPolicy(id: string, data: Partial<EscalationPolicy>): Promise<EscalationPolicy | undefined>;

  getIncident(id: string): Promise<Incident | undefined>;
  getIncidents(accountId?: string, status?: string): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, data: Partial<Incident>): Promise<Incident | undefined>;

  getCallSession(id: string): Promise<CallSession | undefined>;
  getCallSessions(accountId?: string): Promise<CallSession[]>;
  getActiveCallSessions(accountId?: string): Promise<CallSession[]>;
  createCallSession(session: InsertCallSession): Promise<CallSession>;
  updateCallSession(id: string, data: Partial<CallSession>): Promise<CallSession | undefined>;

  getUsageRecords(accountId?: string): Promise<UsageRecord[]>;
  createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord>;
  updateUsageRecord(id: string, data: Partial<UsageRecord>): Promise<UsageRecord | undefined>;

  verifyOwnership(table: string, id: string, accountId: string): Promise<boolean>;
  getSuperAdminUser(): Promise<User | undefined>;
  bootstrapSuperAdmin(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async getAccounts(): Promise<Account[]> {
    return db.select().from(accounts);
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values(account).returning();
    return created;
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<Account | undefined> {
    const [updated] = await db.update(accounts).set({ ...data, updatedAt: new Date() }).where(eq(accounts.id, id)).returning();
    return updated || undefined;
  }

  async deleteAccount(id: string): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  async getLocations(accountId?: string): Promise<Location[]> {
    if (accountId) {
      return db.select().from(locations).where(eq(locations.accountId, accountId));
    }
    return db.select().from(locations);
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [created] = await db.insert(locations).values(location).returning();
    return created;
  }

  async updateLocation(id: string, data: Partial<Location>): Promise<Location | undefined> {
    const [updated] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return updated || undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsers(accountId?: string): Promise<User[]> {
    if (accountId) {
      return db.select().from(users).where(eq(users.accountId, accountId));
    }
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [created] = await db.insert(users).values({ ...user, password: hashedPassword }).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }

  async getProperties(accountId?: string): Promise<Property[]> {
    if (accountId) {
      return db.select().from(properties).where(eq(properties.accountId, accountId));
    }
    return db.select().from(properties);
  }

  async searchProperty(query: string, accountId: string): Promise<Property[]> {
    return db.select().from(properties).where(
      and(
        eq(properties.accountId, accountId),
        or(
          ilike(properties.name, `%${query}%`),
          ilike(properties.address, `%${query}%`)
        )
      )
    );
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [created] = await db.insert(properties).values(property).returning();
    return created;
  }

  async updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined> {
    const [updated] = await db.update(properties).set(data).where(eq(properties.id, id)).returning();
    return updated || undefined;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getUnit(id: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit || undefined;
  }

  async getUnits(propertyId?: string): Promise<Unit[]> {
    if (propertyId) {
      return db.select().from(units).where(eq(units.propertyId, propertyId));
    }
    return db.select().from(units);
  }

  async getUnitByNumber(propertyId: string, unitNumber: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(
      and(eq(units.propertyId, propertyId), eq(units.unitNumber, unitNumber))
    );
    return unit || undefined;
  }

  async createUnit(unit: InsertUnit): Promise<Unit> {
    const [created] = await db.insert(units).values(unit).returning();
    return created;
  }

  async updateUnit(id: string, data: Partial<Unit>): Promise<Unit | undefined> {
    const [updated] = await db.update(units).set(data).where(eq(units.id, id)).returning();
    return updated || undefined;
  }

  async deleteUnit(id: string): Promise<void> {
    await db.delete(units).where(eq(units.id, id));
  }

  async getUnitsForAccount(accountId: string): Promise<Unit[]> {
    return db.select().from(units).where(eq(units.accountId, accountId));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async getVendors(accountId?: string): Promise<Vendor[]> {
    if (accountId) {
      return db.select().from(vendors).where(eq(vendors.accountId, accountId));
    }
    return db.select().from(vendors);
  }

  async getVendorsByTrade(trade: string, accountId: string): Promise<Vendor[]> {
    return db.select().from(vendors)
      .where(and(eq(vendors.accountId, accountId), eq(vendors.trade, trade)))
      .orderBy(vendors.priorityRank);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [created] = await db.insert(vendors).values(vendor).returning();
    return created;
  }

  async updateVendor(id: string, data: Partial<Vendor>): Promise<Vendor | undefined> {
    const [updated] = await db.update(vendors).set(data).where(eq(vendors.id, id)).returning();
    return updated || undefined;
  }

  async deleteVendor(id: string): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  async getEscalationPolicy(id: string): Promise<EscalationPolicy | undefined> {
    const [policy] = await db.select().from(escalationPolicies).where(eq(escalationPolicies.id, id));
    return policy || undefined;
  }

  async getEscalationPolicies(accountId?: string): Promise<EscalationPolicy[]> {
    if (accountId) {
      return db.select().from(escalationPolicies).where(eq(escalationPolicies.accountId, accountId));
    }
    return db.select().from(escalationPolicies);
  }

  async createEscalationPolicy(policy: InsertEscalationPolicy): Promise<EscalationPolicy> {
    const [created] = await db.insert(escalationPolicies).values(policy).returning();
    return created;
  }

  async updateEscalationPolicy(id: string, data: Partial<EscalationPolicy>): Promise<EscalationPolicy | undefined> {
    const [updated] = await db.update(escalationPolicies).set(data).where(eq(escalationPolicies.id, id)).returning();
    return updated || undefined;
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident || undefined;
  }

  async getIncidents(accountId?: string, status?: string): Promise<Incident[]> {
    if (accountId && status) {
      return db.select().from(incidents)
        .where(and(eq(incidents.accountId, accountId), eq(incidents.status, status)))
        .orderBy(desc(incidents.createdAt));
    }
    if (accountId) {
      return db.select().from(incidents)
        .where(eq(incidents.accountId, accountId))
        .orderBy(desc(incidents.createdAt));
    }
    if (status) {
      return db.select().from(incidents)
        .where(eq(incidents.status, status))
        .orderBy(desc(incidents.createdAt));
    }
    return db.select().from(incidents).orderBy(desc(incidents.createdAt));
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const auditLog = [{ timestamp: new Date().toISOString(), action: "Incident created" }];
    const [created] = await db.insert(incidents).values({ ...incident, auditLog }).returning();
    return created;
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident | undefined> {
    const existing = await this.getIncident(id);
    if (!existing) return undefined;
    
    const auditLog = (existing.auditLog as any[]) || [];
    if (data.status && data.status !== existing.status) {
      auditLog.push({
        timestamp: new Date().toISOString(),
        action: `Status changed to ${data.status}`,
      });
    }
    
    const [updated] = await db.update(incidents)
      .set({ ...data, updatedAt: new Date(), auditLog })
      .where(eq(incidents.id, id))
      .returning();
    return updated || undefined;
  }

  async getCallSession(id: string): Promise<CallSession | undefined> {
    const [session] = await db.select().from(callSessions).where(eq(callSessions.id, id));
    return session || undefined;
  }

  async getCallSessions(accountId?: string): Promise<CallSession[]> {
    if (accountId) {
      return db.select().from(callSessions)
        .where(eq(callSessions.accountId, accountId))
        .orderBy(desc(callSessions.startTime));
    }
    return db.select().from(callSessions).orderBy(desc(callSessions.startTime));
  }

  async getActiveCallSessions(accountId?: string): Promise<CallSession[]> {
    const activeStates = ["INBOUND_RECEIVED", "AI_GREETING", "AI_INTENT_DETECTION", 
      "AI_PROPERTY_UNIT_RESOLUTION", "AI_INFORMATION_COLLECTION", "AI_ACTION_EXECUTION",
      "ROUTING_TO_HUMAN", "RINGING_USERS", "QUEUE", "CONNECTED"];
    
    const allSessions = await this.getCallSessions(accountId);
    return allSessions.filter(s => activeStates.includes(s.state));
  }

  async createCallSession(session: InsertCallSession): Promise<CallSession> {
    const [created] = await db.insert(callSessions).values(session).returning();
    return created;
  }

  async updateCallSession(id: string, data: Partial<CallSession>): Promise<CallSession | undefined> {
    const [updated] = await db.update(callSessions).set(data).where(eq(callSessions.id, id)).returning();
    return updated || undefined;
  }

  async getUsageRecords(accountId?: string): Promise<UsageRecord[]> {
    if (accountId) {
      return db.select().from(usageRecords).where(eq(usageRecords.accountId, accountId));
    }
    return db.select().from(usageRecords);
  }

  async createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord> {
    const [created] = await db.insert(usageRecords).values(record).returning();
    return created;
  }

  async updateUsageRecord(id: string, data: Partial<UsageRecord>): Promise<UsageRecord | undefined> {
    const [updated] = await db.update(usageRecords).set(data).where(eq(usageRecords.id, id)).returning();
    return updated || undefined;
  }

  async verifyOwnership(table: string, id: string, accountId: string): Promise<boolean> {
    try {
      switch (table) {
        case "vendors": {
          const vendor = await this.getVendor(id);
          return vendor?.accountId === accountId;
        }
        case "properties": {
          const property = await this.getProperty(id);
          return property?.accountId === accountId;
        }
        case "incidents": {
          const incident = await this.getIncident(id);
          return incident?.accountId === accountId;
        }
        case "users": {
          const user = await this.getUser(id);
          return user?.accountId === accountId;
        }
        case "locations": {
          const location = await this.getLocation(id);
          return location?.accountId === accountId;
        }
        case "callSessions": {
          const session = await this.getCallSession(id);
          return session?.accountId === accountId;
        }
        case "escalationPolicies": {
          const policy = await this.getEscalationPolicy(id);
          return policy?.accountId === accountId;
        }
        case "units": {
          const unit = await this.getUnit(id);
          if (!unit) return false;
          const property = await this.getProperty(unit.propertyId);
          return property?.accountId === accountId;
        }
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getSuperAdminUser(): Promise<User | undefined> {
    const allUsers = await this.getUsers();
    return allUsers.find(u => u.role === UserRoles.SUPER_ADMIN);
  }

  async bootstrapSuperAdmin(): Promise<void> {
    const existingSuperAdmin = await this.getSuperAdminUser();
    if (existingSuperAdmin) {
      console.log("[Bootstrap] Super admin already exists, skipping");
      return;
    }

    console.log("\n");
    console.log("╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║                     INITIAL SETUP - SUPER ADMIN                    ║");
    console.log("╠═══════════════════════════════════════════════════════════════════╣");
    console.log("║  Creating default super admin user...                              ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

    const systemAccount = await this.createAccount({
      name: "System",
      tier: "enterprise",
      status: "active",
      billingPlan: "enterprise",
    });

    const hashedPassword = await bcrypt.hash("PointWake2026!", 10);
    await db.insert(users).values({
      accountId: systemAccount.id,
      username: "superadmin",
      password: hashedPassword,
      name: "Super Admin",
      fullName: "System Super Admin",
      email: "admin@pointwake.com",
      role: UserRoles.SUPER_ADMIN,
      availability: "available",
    });

    console.log("\n");
    console.log("╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║                  ⚠️  SECURITY WARNING ⚠️                           ║");
    console.log("╠═══════════════════════════════════════════════════════════════════╣");
    console.log("║  Super Admin Account Created:                                      ║");
    console.log("║                                                                    ║");
    console.log("║  Username: superadmin                                              ║");
    console.log("║  Password: PointWake2026!                                          ║");
    console.log("║                                                                    ║");
    console.log("║  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN ⚠️         ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");
  }
}

export const storage = new DatabaseStorage();
