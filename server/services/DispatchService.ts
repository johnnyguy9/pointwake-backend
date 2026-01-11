import { storage } from "../storage";
import { rulesEngine } from "./RulesEngine";
import { telephonyAdapter } from "./TelephonyAdapter";
import type { Incident, Vendor } from "@shared/schema";

/**
 * PointWake Dispatch Service
 * Handles vendor dispatch, acknowledgment tracking, and escalation.
 */

export interface DispatchResult {
  success: boolean;
  vendorId?: string;
  vendorName?: string;
  method?: "call" | "sms" | "email";
  error?: string;
}

export interface AcknowledgmentResult {
  acknowledged: boolean;
  eta?: string;
  message?: string;
  timeout: boolean;
}

export class PointWakeDispatchService {
  private pendingAcks: Map<string, { resolve: (result: AcknowledgmentResult) => void; timeout: NodeJS.Timeout }> = new Map();

  /**
   * Dispatch a vendor for an incident.
   */
  async dispatchVendor(
    incidentId: string,
    vendorId: string,
    preferredMethod: "call" | "sms" | "email" = "sms"
  ): Promise<DispatchResult> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      return { success: false, error: "Incident not found" };
    }

    const vendor = await storage.getVendor(vendorId);
    if (!vendor) {
      return { success: false, error: "Vendor not found" };
    }

    // Construct dispatch message
    const message = this.buildDispatchMessage(incident, vendor);

    // Try dispatch via preferred method
    let dispatched = false;
    let method: "call" | "sms" | "email" = preferredMethod;

    if (preferredMethod === "sms" && vendor.contactSms) {
      const messageSid = await telephonyAdapter.sendSMS(vendor.contactSms, message);
      dispatched = !!messageSid;
    } else if (preferredMethod === "call" && vendor.contactPhone) {
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : "https://localhost:5000";
      const dispatchUrl = `${baseUrl}/api/twilio/outbound-dispatch?incidentId=${incidentId}&vendorName=${encodeURIComponent(vendor.name)}`;
      const callSid = await telephonyAdapter.makeCall(vendor.contactPhone, dispatchUrl);
      dispatched = !!callSid;
    } else if (vendor.contactEmail) {
      // Email dispatch - stub
      method = "email";
      dispatched = true; // Simulated
      console.log(`[Dispatch] Would email ${vendor.contactEmail} with message: ${message}`);
    }

    if (dispatched) {
      // Update incident
      await storage.updateIncident(incidentId, {
        status: "dispatched",
        assignedVendorId: vendorId,
      });

      // Log action
      const auditLog = (incident.auditLog as any[] || []);
      auditLog.push({
        timestamp: new Date().toISOString(),
        action: "Vendor dispatched",
        details: `${vendor.name} contacted via ${method}`,
      });
      await storage.updateIncident(incidentId, { auditLog });

      return {
        success: true,
        vendorId: vendor.id,
        vendorName: vendor.name,
        method,
      };
    }

    return { success: false, error: "Failed to contact vendor via any method" };
  }

  /**
   * Wait for vendor acknowledgment with timeout.
   */
  async waitForAcknowledgment(
    incidentId: string,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<AcknowledgmentResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(incidentId);
        resolve({ acknowledged: false, timeout: true });
      }, timeoutMs);

      this.pendingAcks.set(incidentId, { resolve, timeout });
    });
  }

  /**
   * Record vendor acknowledgment (called when vendor responds).
   */
  async recordAcknowledgment(
    incidentId: string,
    eta?: string,
    message?: string
  ): Promise<boolean> {
    const pending = this.pendingAcks.get(incidentId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAcks.delete(incidentId);
      pending.resolve({ acknowledged: true, eta, message, timeout: false });
    }

    // Update incident
    const incident = await storage.getIncident(incidentId);
    if (incident) {
      const auditLog = (incident.auditLog as any[] || []);
      auditLog.push({
        timestamp: new Date().toISOString(),
        action: "Vendor acknowledged",
        details: eta ? `ETA: ${eta}` : message || "Acknowledged",
      });
      await storage.updateIncident(incidentId, { 
        status: "in_progress",
        auditLog,
      });
      return true;
    }

    return false;
  }

  /**
   * Escalate to next level (backup vendor or on-call manager).
   */
  async escalate(
    incidentId: string,
    toUserGroup?: string
  ): Promise<DispatchResult> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      return { success: false, error: "Incident not found" };
    }

    // Update incident status
    await storage.updateIncident(incidentId, { status: "escalated" });

    // Log escalation
    const auditLog = (incident.auditLog as any[] || []);
    auditLog.push({
      timestamp: new Date().toISOString(),
      action: "Escalated",
      details: toUserGroup ? `Escalated to ${toUserGroup}` : "Escalated to management",
    });
    await storage.updateIncident(incidentId, { auditLog });

    // If toUserGroup specified, try to notify those users
    if (toUserGroup === "on_call") {
      const users = await storage.getUsers(incident.accountId);
      const onCallUsers = users.filter(u => u.role === "on_call" && u.availability !== "offline");
      
      for (const user of onCallUsers) {
        if (user.phoneNumber) {
          const escalationMsg = `ESCALATION: ${incident.summary || "New incident"} requires attention. Incident ID: ${incident.id.slice(0, 8)}`;
          await telephonyAdapter.sendSMS(user.phoneNumber, escalationMsg);
        }
      }
    }

    return { success: true };
  }

  /**
   * Build dispatch message for vendor.
   */
  private buildDispatchMessage(incident: Incident, vendor: Vendor): string {
    const parts = [
      `SERVICE REQUEST - ${incident.severity?.toUpperCase() || "NORMAL"}`,
      `Trade: ${incident.trade || "General"}`,
      `Issue: ${incident.summary || "See details"}`,
    ];

    if (incident.description) {
      parts.push(`Details: ${incident.description}`);
    }

    parts.push(`Ref: ${incident.id.slice(0, 8)}`);
    parts.push("Reply YES to accept or call for details.");

    return parts.join("\n");
  }
}

export const dispatchService = new PointWakeDispatchService();
