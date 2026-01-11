import { storage } from "../storage";
import type { Property, Unit, Vendor, EscalationPolicy, Incident } from "@shared/schema";

/**
 * PointWake Rules Engine
 * Deterministic decision-making for property/unit/vendor/escalation policy selection.
 * Never fabricates data - returns null/error if required data is missing.
 */

export interface TradeClassification {
  trade: string;
  severity: "emergency" | "urgent" | "normal" | "low";
  confidence: number;
  keywords: string[];
}

export interface ResolutionResult {
  property?: Property;
  unit?: Unit;
  error?: string;
}

export interface VendorSelection {
  vendor?: Vendor;
  backups: Vendor[];
  error?: string;
}

export interface EscalationDecision {
  policy?: EscalationPolicy;
  requiresHumanApproval: boolean;
  reason?: string;
}

const TRADE_KEYWORDS: Record<string, string[]> = {
  hvac: ["ac", "air conditioning", "heating", "furnace", "thermostat", "hvac", "cool", "heat", "temperature", "ventilation"],
  plumbing: ["water", "leak", "pipe", "drain", "toilet", "faucet", "sink", "shower", "plumbing", "clog", "flood", "sewer"],
  electrical: ["power", "outlet", "light", "electric", "breaker", "switch", "wiring", "spark", "voltage"],
  appliance: ["refrigerator", "fridge", "washer", "dryer", "dishwasher", "stove", "oven", "microwave", "appliance"],
  roofing: ["roof", "shingle", "gutter", "leak from ceiling", "attic"],
  locksmith: ["lock", "key", "door", "deadbolt", "locked out"],
  pest_control: ["pest", "bug", "roach", "ant", "mouse", "rat", "rodent", "termite", "bed bug"],
  general: ["maintenance", "repair", "fix", "broken"],
};

const EMERGENCY_KEYWORDS = [
  "flood", "flooding", "fire", "smoke", "gas leak", "gas smell", "carbon monoxide",
  "no heat", "frozen pipe", "burst pipe", "sewage", "electrical fire", "sparking",
  "emergency", "urgent", "immediate", "dangerous", "safety hazard"
];

const URGENT_KEYWORDS = [
  "not working", "broken", "no hot water", "no power", "locked out",
  "leaking", "clogged", "overflowing"
];

export class PointWakeRulesEngine {
  /**
   * Classify the trade and severity based on caller text.
   * Uses keyword matching - does NOT guess.
   */
  classifyTradeAndSeverity(callerText: string): TradeClassification {
    const text = callerText.toLowerCase();
    const matchedKeywords: string[] = [];
    let matchedTrade = "general";
    let maxScore = 0;

    // Find best matching trade
    for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++;
          matchedKeywords.push(keyword);
        }
      }
      if (score > maxScore) {
        maxScore = score;
        matchedTrade = trade;
      }
    }

    // Determine severity
    let severity: "emergency" | "urgent" | "normal" | "low" = "normal";
    for (const keyword of EMERGENCY_KEYWORDS) {
      if (text.includes(keyword)) {
        severity = "emergency";
        matchedKeywords.push(keyword);
        break;
      }
    }
    if (severity !== "emergency") {
      for (const keyword of URGENT_KEYWORDS) {
        if (text.includes(keyword)) {
          severity = "urgent";
          matchedKeywords.push(keyword);
          break;
        }
      }
    }

    // Calculate confidence based on keyword matches
    const confidence = Math.min(1, maxScore * 0.25 + (matchedKeywords.length > 3 ? 0.25 : 0));

    return {
      trade: matchedTrade,
      severity,
      confidence,
      keywords: [...new Set(matchedKeywords)],
    };
  }

  /**
   * Resolve property and unit from caller input.
   * Never fabricates - returns error if not found.
   */
  async resolvePropertyAndUnit(
    query: string,
    accountId: string,
    unitNumber?: string
  ): Promise<ResolutionResult> {
    // Search for property
    const properties = await storage.searchProperty(query, accountId);
    
    if (properties.length === 0) {
      return { error: `Property not found: "${query}"` };
    }

    const property = properties[0];

    // If unit number provided, look it up
    if (unitNumber) {
      const unit = await storage.getUnitByNumber(property.id, unitNumber);
      if (!unit) {
        return { 
          property,
          error: `Unit ${unitNumber} not found at ${property.name}`,
        };
      }
      return { property, unit };
    }

    return { property };
  }

  /**
   * Select preferred vendor for a trade at a property.
   * Uses structured data only - never invents vendors.
   */
  async selectVendor(
    trade: string,
    propertyId: string,
    accountId: string,
    afterHours: boolean = false
  ): Promise<VendorSelection> {
    const property = await storage.getProperty(propertyId);
    
    if (!property) {
      return { backups: [], error: "Property not found" };
    }

    // Get preferred vendors from property config
    const preferredVendorIds = property.preferredVendorsByTrade?.[trade] || [];
    const allVendors = await storage.getVendorsByTrade(trade, accountId);

    if (allVendors.length === 0) {
      return { backups: [], error: `No vendors available for trade: ${trade}` };
    }

    // Filter by after-hours availability if needed
    let availableVendors = afterHours 
      ? allVendors.filter(v => v.afterHoursAvailable)
      : allVendors;

    if (availableVendors.length === 0 && afterHours) {
      return { 
        backups: allVendors,
        error: `No after-hours vendors available for ${trade}. Non-after-hours vendors listed as backups.`,
      };
    }

    // Prefer property-specific vendors
    let primaryVendor = availableVendors.find(v => preferredVendorIds.includes(v.id));
    
    if (!primaryVendor) {
      // Fall back to highest priority vendor
      primaryVendor = availableVendors[0];
    }

    // Get backups
    const backups = availableVendors.filter(v => v.id !== primaryVendor?.id);

    return { vendor: primaryVendor, backups };
  }

  /**
   * Get escalation policy for a property and determine if human approval needed.
   */
  async getEscalationDecision(
    propertyId: string,
    severity: string,
    estimatedCost?: number
  ): Promise<EscalationDecision> {
    const property = await storage.getProperty(propertyId);
    
    if (!property?.emergencyPolicyId) {
      return {
        requiresHumanApproval: severity === "emergency",
        reason: "No escalation policy configured - defaulting to require approval for emergencies",
      };
    }

    const policy = await storage.getEscalationPolicy(property.emergencyPolicyId);
    
    if (!policy) {
      return {
        requiresHumanApproval: severity === "emergency",
        reason: "Escalation policy not found",
      };
    }

    const rules = policy.rules as { spendThreshold?: number; emergencyDefinitions?: string[] } | null;
    const wakeConditions = policy.wakeHumanConditions || [];

    let requiresHumanApproval = false;
    let reason: string | undefined;

    // Check emergency conditions
    if (severity === "emergency" && wakeConditions.includes("emergency")) {
      requiresHumanApproval = true;
      reason = "Emergency requires human approval";
    }

    // Check spend threshold
    if (estimatedCost && rules?.spendThreshold && estimatedCost > rules.spendThreshold) {
      if (wakeConditions.includes("spend_over_threshold")) {
        requiresHumanApproval = true;
        reason = `Estimated cost $${estimatedCost} exceeds threshold $${rules.spendThreshold}`;
      }
    }

    return { policy, requiresHumanApproval, reason };
  }

  /**
   * Check if current time is within business hours.
   */
  async isBusinessHours(locationId: string): Promise<boolean> {
    const location = await storage.getLocation(locationId);
    
    if (!location) return false;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const [startH, startM] = (location.businessHoursStart || "09:00").split(":").map(Number);
    const [endH, endM] = (location.businessHoursEnd || "17:00").split(":").map(Number);
    
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    return currentTime >= startTime && currentTime <= endTime;
  }
}

export const rulesEngine = new PointWakeRulesEngine();
