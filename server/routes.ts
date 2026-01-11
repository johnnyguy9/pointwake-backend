import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import passport from "passport";
import { storage } from "./storage";
import { rulesEngine } from "./services/RulesEngine";
import { dispatchService } from "./services/DispatchService";
import { billingService } from "./services/BillingService";
import { telephonyAdapter } from "./services/TelephonyAdapter";
import { 
  handleIncomingCall, handleGather, handleCallStatus, handleIncomingSMS, 
  handleOutboundDispatch, handleDispatchResponse, validateTwilioSignature,
  handleAIVoiceCall
} from "./services/TwilioWebhooks";
import { handleTwilioMediaStream } from "./services/OpenAIRealtimeHandler";
import {
  handleExternalAIIncomingCall,
  handleTransferRequest,
  handleTransferConnect,
  handleTransferStatus,
  handleVoicemail,
  handleCallEnded,
  getAvailableLocations,
  getCallSessionInfo,
} from "./services/ExternalAIOperator";
import {
  generateClientToken,
  registerDevice,
  updatePresence,
  getLocationStaffStatus,
  handleClientCall,
  getUserDevices,
  deviceHeartbeat,
} from "./services/VoIPService";
import {
  startShift,
  endShift,
  getCurrentShift,
  getOnDutyStaff,
  updateStaffLocation,
  getLocationsSummary,
} from "./services/StaffManagement";
import {
  getCallHistory,
  getCallDetails,
  getCallStats,
  exportCallHistory,
} from "./services/CallHistory";
import {
  handleVapiServerUrl,
  getActiveVapiCalls,
  checkVapiHealth,
  setVapiBroadcast,
} from "./services/VapiIntegration";
import { isAuthenticated, requireAccountAdmin, requireSuperAdmin, createOwnershipMiddleware } from "./middleware/permissions";
import { UserRoles } from "@shared/schema";
import { WakeAnalyzerService } from "./services/WakeAnalyzerService";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = process.env.WAKE_ANALYZER_UPLOAD_DIR || "/tmp/wake-analyzer-uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const wsClients: Map<string, Set<WebSocket>> = new Map();

function broadcastToAccount(accountId: string, message: object) {
  const clients = wsClients.get(accountId);
  if (clients) {
    const data = JSON.stringify(message);
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    let accountId: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "auth" && message.payload?.accountId) {
          accountId = message.payload.accountId;
          if (accountId) {
            if (!wsClients.has(accountId)) {
              wsClients.set(accountId, new Set());
            }
            wsClients.get(accountId)!.add(ws);
            ws.send(JSON.stringify({ type: "auth_success" }));
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      if (accountId) {
        wsClients.get(accountId)?.delete(ws);
      }
    });
  });

  const mediaWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url || "";
    
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (pathname.startsWith("/media-stream/")) {
      const callSessionId = pathname.split("/media-stream/")[1];
      mediaWss.handleUpgrade(request, socket, head, (ws) => {
        console.log(`[Media Stream] New connection for session: ${callSessionId}`);
        handleTwilioMediaStream(ws, callSessionId);
      });
    } else {
      socket.destroy();
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login error" });
        }
        const { password, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout error" });
      }
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          return res.status(500).json({ error: "Session destruction error" });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.get("/api/users", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const users = await storage.getUsers(accountId);
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && user.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/users", isAuthenticated, requireAccountAdmin, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? req.body.accountId 
      : req.user!.accountId;
    
    const user = await storage.createUser({
      ...req.body,
      accountId,
    });
    const { password, ...safeUser } = user;
    res.status(201).json(safeUser);
  });

  app.patch("/api/users/:id/availability", isAuthenticated, async (req, res) => {
    const { availability } = req.body;
    
    if (!["available", "busy", "offline"].includes(availability)) {
      return res.status(400).json({ error: "Invalid availability status" });
    }

    const user = await storage.updateUser(req.params.id, { availability });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password, ...safeUser } = user;
    
    broadcastToAccount(user.accountId, {
      type: "user_availability_changed",
      payload: safeUser,
    });

    res.json(safeUser);
  });

  app.delete("/api/users/:id", isAuthenticated, requireAccountAdmin, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && user.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const activeCalls = await storage.getActiveCallSessions(accountId);
    const incidents = await storage.getIncidents(accountId);
    const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "escalated");
    const usageRecords = await storage.getUsageRecords(accountId);

    const totalMinutes = usageRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
    const aiMinutes = usageRecords.reduce((sum, r) => sum + (r.aiMinutes || 0), 0);
    const totalCalls = usageRecords.reduce((sum, r) => sum + (r.totalCalls || 0), 0);
    const totalDispatches = usageRecords.reduce((sum, r) => sum + (r.dispatchActions || 0), 0);

    res.json({
      activeCalls: activeCalls.length,
      openIncidents: openIncidents.length,
      aiHandledPercent: totalMinutes > 0 ? Math.round((aiMinutes / totalMinutes) * 100) : 0,
      avgHandleTime: totalCalls > 0 ? Math.round((totalMinutes / totalCalls) * 10) / 10 : 0,
      dispatchesToday: totalDispatches,
      callsToday: totalCalls,
    });
  });

  app.get("/api/activity/recent", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const incidents = await storage.getIncidents(accountId);
    const calls = await storage.getCallSessions(accountId);

    const activities: any[] = [];

    incidents.slice(0, 5).forEach((incident) => {
      activities.push({
        id: `incident-${incident.id}`,
        type: "incident",
        title: incident.summary || "New incident",
        description: incident.trade ? `${incident.trade} - ${incident.status}` : incident.status,
        timestamp: incident.createdAt,
        severity: incident.severity,
      });

      const auditLog = incident.auditLog as any[] | null;
      if (auditLog) {
        auditLog.filter(a => a.action?.includes("dispatch")).forEach((action, idx) => {
          activities.push({
            id: `dispatch-${incident.id}-${idx}`,
            type: "dispatch",
            title: action.action,
            description: action.details || "",
            timestamp: new Date(action.timestamp),
          });
        });
      }
    });

    calls.slice(0, 3).forEach((call) => {
      activities.push({
        id: `call-${call.id}`,
        type: "call",
        title: `Call from ${call.callerNumber}`,
        description: call.outcome || call.state,
        timestamp: call.startTime,
      });
    });

    activities.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    res.json(activities.slice(0, 10));
  });

  app.get("/api/calls", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const calls = await storage.getCallSessions(accountId);
    res.json(calls);
  });

  app.get("/api/calls/active", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const calls = await storage.getActiveCallSessions(accountId);
    res.json(calls);
  });

  app.get("/api/calls/:id", isAuthenticated, async (req, res) => {
    const call = await storage.getCallSession(req.params.id);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && call.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(call);
  });

  app.post("/api/calls", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? req.body.accountId 
      : req.user!.accountId;
    
    const call = await storage.createCallSession({ ...req.body, accountId });
    
    broadcastToAccount(call.accountId, {
      type: "incoming_call",
      payload: call,
    });

    res.status(201).json(call);
  });

  app.patch("/api/calls/:id", isAuthenticated, async (req, res) => {
    const call = await storage.updateCallSession(req.params.id, req.body);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    broadcastToAccount(call.accountId, {
      type: "call_updated",
      payload: call,
    });

    res.json(call);
  });

  app.get("/api/incidents", isAuthenticated, async (req, res) => {
    const status = req.query.status as string | undefined;
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const incidents = await storage.getIncidents(accountId, status);
    res.json(incidents);
  });

  app.get("/api/incidents/:id", isAuthenticated, async (req, res) => {
    const incident = await storage.getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && incident.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(incident);
  });

  app.post("/api/incidents", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? req.body.accountId 
      : req.user!.accountId;
    
    const incident = await storage.createIncident({ ...req.body, accountId });
    
    broadcastToAccount(incident.accountId, {
      type: "new_incident",
      payload: incident,
    });

    res.status(201).json(incident);
  });

  app.patch("/api/incidents/:id", isAuthenticated, async (req, res) => {
    const incident = await storage.updateIncident(req.params.id, req.body);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    broadcastToAccount(incident.accountId, {
      type: "incident_updated",
      payload: incident,
    });

    res.json(incident);
  });

  app.get("/api/properties", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const properties = await storage.getProperties(accountId);
    res.json(properties);
  });

  app.get("/api/properties/:id", isAuthenticated, async (req, res) => {
    const property = await storage.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && property.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(property);
  });

  app.post("/api/properties", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? req.body.accountId 
      : req.user!.accountId;
    
    const property = await storage.createProperty({ ...req.body, accountId });
    res.status(201).json(property);
  });

  app.patch("/api/properties/:id", isAuthenticated, async (req, res) => {
    const property = await storage.updateProperty(req.params.id, req.body);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(property);
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    const property = await storage.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && property.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    await storage.deleteProperty(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/units", isAuthenticated, async (req, res) => {
    const propertyId = req.query.propertyId as string | undefined;
    const units = await storage.getUnits(propertyId);
    res.json(units);
  });

  app.get("/api/units/:id", isAuthenticated, async (req, res) => {
    const unit = await storage.getUnit(req.params.id);
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    res.json(unit);
  });

  app.get("/api/vendors", isAuthenticated, async (req, res) => {
    const trade = req.query.trade as string | undefined;
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    let vendors = await storage.getVendors(accountId);
    if (trade) {
      vendors = vendors.filter((v) => v.trade === trade);
    }
    res.json(vendors);
  });

  app.get("/api/vendors/:id", isAuthenticated, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && vendor.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(vendor);
  });

  app.post("/api/vendors", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? req.body.accountId 
      : req.user!.accountId;
    
    const vendor = await storage.createVendor({ ...req.body, accountId });
    res.status(201).json(vendor);
  });

  app.patch("/api/vendors/:id", isAuthenticated, async (req, res) => {
    const vendor = await storage.updateVendor(req.params.id, req.body);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  });

  app.delete("/api/vendors/:id", isAuthenticated, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && vendor.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    await storage.deleteVendor(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/policies", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const policies = await storage.getEscalationPolicies(accountId);
    res.json(policies);
  });

  app.get("/api/policies/:id", isAuthenticated, async (req, res) => {
    const policy = await storage.getEscalationPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  });

  app.get("/api/usage", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const records = await storage.getUsageRecords(accountId);
    res.json(records);
  });

  app.get("/api/usage/account/:id", isAuthenticated, async (req, res) => {
    const summary = await billingService.getUsageSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(summary);
  });

  app.get("/api/billing/estimate", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? (await storage.getAccounts())[0]?.id 
      : req.user!.accountId;
    
    if (!accountId) {
      return res.json({
        accountId: "none",
        period: new Date().toISOString().slice(0, 7),
        locationCount: 0,
        baseCharges: 0,
        aiMinutes: 0,
        aiCharges: 0,
        totalEstimate: 0,
      });
    }

    const estimate = await billingService.calculateBillingEstimate(accountId);
    res.json(estimate);
  });

  app.get("/api/billing/estimate/:id", isAuthenticated, async (req, res) => {
    const estimate = await billingService.calculateBillingEstimate(req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(estimate);
  });

  app.post("/api/dispatch", isAuthenticated, async (req, res) => {
    const { incidentId, vendorId, method } = req.body;
    
    if (!incidentId || !vendorId) {
      return res.status(400).json({ error: "incidentId and vendorId required" });
    }

    const result = await dispatchService.dispatchVendor(incidentId, vendorId, method);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  app.post("/api/dispatch/acknowledge", isAuthenticated, async (req, res) => {
    const { incidentId, eta, message } = req.body;
    
    if (!incidentId) {
      return res.status(400).json({ error: "incidentId required" });
    }

    const success = await dispatchService.recordAcknowledgment(incidentId, eta, message);
    res.json({ success });
  });

  app.post("/api/dispatch/escalate", isAuthenticated, async (req, res) => {
    const { incidentId, toUserGroup } = req.body;
    
    if (!incidentId) {
      return res.status(400).json({ error: "incidentId required" });
    }

    const result = await dispatchService.escalate(incidentId, toUserGroup);
    res.json(result);
  });

  app.post("/api/rules/classify", isAuthenticated, async (req, res) => {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "text required" });
    }

    const classification = rulesEngine.classifyTradeAndSeverity(text);
    res.json(classification);
  });

  app.post("/api/rules/resolve-property", isAuthenticated, async (req, res) => {
    const { query, accountId, unitNumber } = req.body;
    const resolvedAccountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? accountId 
      : req.user!.accountId;
    
    if (!query) {
      return res.status(400).json({ error: "query required" });
    }

    const result = await rulesEngine.resolvePropertyAndUnit(query, resolvedAccountId, unitNumber);
    res.json(result);
  });

  app.post("/api/rules/select-vendor", isAuthenticated, async (req, res) => {
    const { trade, propertyId, accountId, afterHours } = req.body;
    const resolvedAccountId = req.user!.role === UserRoles.SUPER_ADMIN 
      ? accountId 
      : req.user!.accountId;
    
    if (!trade || !propertyId) {
      return res.status(400).json({ error: "trade and propertyId required" });
    }

    const result = await rulesEngine.selectVendor(trade, propertyId, resolvedAccountId, afterHours);
    res.json(result);
  });

  app.get("/api/locations", isAuthenticated, async (req, res) => {
    const accountId = req.user!.role === UserRoles.SUPER_ADMIN ? undefined : req.user!.accountId;
    const locations = await storage.getLocations(accountId);
    res.json(locations);
  });

  app.get("/api/locations/:id", isAuthenticated, async (req, res) => {
    const location = await storage.getLocation(req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  });

  app.get("/api/accounts", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const accounts = await storage.getAccounts();
    res.json(accounts);
  });

  app.get("/api/accounts/:id", isAuthenticated, async (req, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    if (req.user!.role !== UserRoles.SUPER_ADMIN && req.user!.accountId !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(account);
  });

  app.post("/api/accounts", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const account = await storage.createAccount(req.body);
    res.status(201).json(account);
  });

  app.patch("/api/accounts/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const account = await storage.updateAccount(req.params.id, req.body);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  });

  app.post("/api/admin/provision-account", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const { accountName, tier, adminUsername, adminPassword, adminEmail, adminFullName } = req.body;
    
    if (!accountName || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: "accountName, adminUsername, and adminPassword required" });
    }

    try {
      const account = await storage.createAccount({
        name: accountName,
        tier: tier || "professional",
        status: "active",
        billingPlan: tier || "professional",
      });

      const user = await storage.createUser({
        accountId: account.id,
        username: adminUsername,
        password: adminPassword,
        name: adminFullName || adminUsername,
        fullName: adminFullName,
        email: adminEmail,
        role: UserRoles.ACCOUNT_ADMIN,
        availability: "offline",
      });

      const { password, ...safeUser } = user;
      res.status(201).json({ account, user: safeUser });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to provision account" });
    }
  });

  app.post("/api/twilio/voice", validateTwilioSignature, handleIncomingCall);
  app.post("/api/twilio/ai-voice", validateTwilioSignature, handleAIVoiceCall);
  app.post("/api/twilio/gather", validateTwilioSignature, handleGather);
  app.post("/api/twilio/status", validateTwilioSignature, handleCallStatus);
  app.post("/api/twilio/sms", validateTwilioSignature, handleIncomingSMS);
  app.post("/api/twilio/outbound-dispatch", validateTwilioSignature, handleOutboundDispatch);
  app.post("/api/twilio/dispatch-response", validateTwilioSignature, handleDispatchResponse);

  // ============ EXTERNAL AI OPERATOR ENDPOINTS ============
  // Main entry point for external AI to receive calls
  app.post("/api/operator/incoming", validateTwilioSignature, handleExternalAIIncomingCall);
  // External AI calls this to transfer caller to a location's staff
  app.post("/api/operator/transfer", handleTransferRequest);
  // TwiML endpoint for connecting transferred calls
  app.post("/api/operator/transfer-connect", validateTwilioSignature, handleTransferConnect);
  // Transfer status callback
  app.post("/api/operator/transfer-status", validateTwilioSignature, handleTransferStatus);
  // Voicemail handling
  app.post("/api/operator/voicemail", validateTwilioSignature, handleVoicemail);
  // External AI notifies when call ends
  app.post("/api/operator/call-ended", handleCallEnded);
  // Get available locations for routing
  app.get("/api/operator/locations", getAvailableLocations);
  // Get call session info
  app.get("/api/operator/session/:callSessionId", getCallSessionInfo);

  // ============ VAPI VOICE AI WEBHOOKS ============
  // Initialize Vapi broadcast function
  setVapiBroadcast(broadcastToAccount);
  
  // Main Vapi Server URL - handles all Vapi events
  // Configure in Vapi Dashboard: Server URL = https://your-domain/webhooks/vapi/server-url
  app.post("/webhooks/vapi/server-url", handleVapiServerUrl);
  
  // Alternate paths Vapi might call
  app.post("/api/vapi/webhook", handleVapiServerUrl);
  app.post("/webhooks/twilio/inbound", handleVapiServerUrl); // If Vapi proxies through Twilio
  
  // Vapi health/status endpoints
  app.get("/api/vapi/calls", isAuthenticated, getActiveVapiCalls);
  app.get("/api/vapi/health", checkVapiHealth);

  // ============ VOIP / STAFF APP ENDPOINTS ============
  // Generate Twilio Client token for staff app
  app.post("/api/voip/token", isAuthenticated, generateClientToken);
  // Register device for push notifications
  app.post("/api/voip/register-device", isAuthenticated, registerDevice);
  // Update presence/availability
  app.post("/api/voip/presence", isAuthenticated, updatePresence);
  // Get staff status at a location
  app.get("/api/voip/staff/:locationId", isAuthenticated, getLocationStaffStatus);
  // Get user's registered devices
  app.get("/api/voip/devices", isAuthenticated, getUserDevices);
  // Device heartbeat
  app.post("/api/voip/heartbeat", isAuthenticated, deviceHeartbeat);
  // Handle Twilio Client calls
  app.post("/api/voip/call", validateTwilioSignature, handleClientCall);

  // ============ STAFF MANAGEMENT ENDPOINTS ============
  // Start on-duty shift
  app.post("/api/staff/shift/start", isAuthenticated, startShift);
  // End on-duty shift
  app.post("/api/staff/shift/end", isAuthenticated, endShift);
  // Get current shift info
  app.get("/api/staff/shift", isAuthenticated, getCurrentShift);
  // Get all on-duty staff
  app.get("/api/staff/on-duty", isAuthenticated, getOnDutyStaff);
  // Update staff location assignment
  app.post("/api/staff/assign-location", isAuthenticated, updateStaffLocation);
  // Get locations summary with staff counts
  app.get("/api/staff/locations-summary", isAuthenticated, getLocationsSummary);

  // ============ CALL HISTORY ENDPOINTS ============
  // Get call history with filters
  app.get("/api/calls/history", isAuthenticated, getCallHistory);
  // Get call details
  app.get("/api/calls/:callId", isAuthenticated, getCallDetails);
  // Get call statistics
  app.get("/api/calls/stats", isAuthenticated, getCallStats);
  // Export call history as CSV
  app.get("/api/calls/export", isAuthenticated, exportCallHistory);

  app.post("/api/dispatch/sms", isAuthenticated, async (req, res) => {
    const { vendorId, incidentId, message } = req.body;

    if (!vendorId || !message) {
      return res.status(400).json({ error: "vendorId and message required" });
    }

    const vendor = await storage.getVendor(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    if (req.user!.role !== UserRoles.SUPER_ADMIN && vendor.accountId !== req.user!.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const phoneNumber = vendor.contactSms || vendor.contactPhone;
    if (!phoneNumber) {
      return res.status(400).json({ error: "Vendor has no phone number" });
    }

    const messageSid = await telephonyAdapter.sendSMS(phoneNumber, message);
    
    if (messageSid) {
      if (incidentId) {
        const incident = await storage.getIncident(incidentId);
        if (incident) {
          const auditLog = (incident.auditLog as any[]) || [];
          auditLog.push({
            timestamp: new Date().toISOString(),
            action: "SMS dispatched",
            details: `Sent to ${vendor.name} at ${phoneNumber}`,
          });
          await storage.updateIncident(incidentId, {
            status: "dispatched",
            assignedVendorId: vendorId,
            auditLog,
          });
        }
      }
      res.json({ success: true, messageSid });
    } else {
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.get("/api/twilio/test", async (req, res) => {
    const fromNumber = telephonyAdapter.getFromNumber();
    res.json({
      configured: !!fromNumber,
      fromNumber: fromNumber ? `${fromNumber.slice(0, 6)}...` : null,
    });
  });

  // ============ WAKE ANALYZER ROUTES ============

  // Health check for Python service
  app.get("/api/wake-analyzer/health", isAuthenticated, async (req, res) => {
    const health = await WakeAnalyzerService.healthCheck();
    res.json(health);
  });

  // Upload CSV dataset
  app.post("/api/wake-analyzer/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await WakeAnalyzerService.uploadDataset(req.file, req.user!);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // Validate execution plan
  app.post("/api/wake-analyzer/validate", isAuthenticated, async (req, res) => {
    const plan = req.body;

    if (!plan) {
      return res.status(400).json({ error: "No plan provided" });
    }

    const result = await WakeAnalyzerService.validatePlan(plan);
    res.json(result);
  });

  // Execute analytics plan
  app.post("/api/wake-analyzer/execute", isAuthenticated, async (req, res) => {
    const { sessionId, plan } = req.body;

    if (!sessionId || !plan) {
      return res.status(400).json({ error: "sessionId and plan required" });
    }

    const result = await WakeAnalyzerService.executePlan(sessionId, plan, req.user!);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // Get dataset metadata
  app.get("/api/wake-analyzer/datasets/:sessionId", isAuthenticated, async (req, res) => {
    const dataset = await WakeAnalyzerService.getDataset(req.params.sessionId, req.user!);

    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }

    res.json(dataset);
  });

  // Get user's datasets
  app.get("/api/wake-analyzer/datasets", isAuthenticated, async (req, res) => {
    const datasets = await WakeAnalyzerService.getUserDatasets(req.user!);
    res.json(datasets);
  });

  // Get analysis history for a dataset
  app.get("/api/wake-analyzer/history/:sessionId", isAuthenticated, async (req, res) => {
    const history = await WakeAnalyzerService.getAnalysisHistory(req.params.sessionId, req.user!);
    res.json(history);
  });

  // Delete dataset
  app.delete("/api/wake-analyzer/datasets/:sessionId", isAuthenticated, async (req, res) => {
    const success = await WakeAnalyzerService.deleteDataset(req.params.sessionId, req.user!);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Dataset not found" });
    }
  });

  return httpServer;
}
