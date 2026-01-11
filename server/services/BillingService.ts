import { storage } from "../storage";
import type { Account, UsageRecord } from "@shared/schema";

/**
 * PointWake Billing Service
 * Tracks usage and calculates billing estimates.
 */

export interface UsageSummary {
  accountId: string;
  period: string;
  totalCalls: number;
  totalMinutes: number;
  aiMinutes: number;
  incidentsHandled: number;
  dispatchActions: number;
  locationCount: number;
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

export class PointWakeBillingService {
  /**
   * Get usage summary for an account.
   */
  async getUsageSummary(accountId: string): Promise<UsageSummary | null> {
    const account = await storage.getAccount(accountId);
    if (!account) return null;

    const records = await storage.getUsageRecords(accountId);
    const locations = await storage.getLocations(accountId);
    
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const periodRecords = records.filter(r => r.period === period);

    const summary: UsageSummary = {
      accountId,
      period,
      totalCalls: 0,
      totalMinutes: 0,
      aiMinutes: 0,
      incidentsHandled: 0,
      dispatchActions: 0,
      locationCount: locations.length,
    };

    for (const record of periodRecords) {
      summary.totalCalls += record.totalCalls || 0;
      summary.totalMinutes += record.totalMinutes || 0;
      summary.aiMinutes += record.aiMinutes || 0;
      summary.incidentsHandled += record.incidentsHandled || 0;
      summary.dispatchActions += record.dispatchActions || 0;
    }

    return summary;
  }

  /**
   * Calculate billing estimate for an account.
   */
  async calculateBillingEstimate(accountId: string): Promise<BillingEstimate | null> {
    const account = await storage.getAccount(accountId);
    if (!account) return null;

    const summary = await this.getUsageSummary(accountId);
    if (!summary) return null;

    const baseCharges = summary.locationCount * (account.baseFeePerLocation || 99);
    const aiCharges = summary.aiMinutes * (account.aiRatePerMinute || 0.15);

    return {
      accountId,
      period: summary.period,
      locationCount: summary.locationCount,
      baseCharges,
      aiMinutes: summary.aiMinutes,
      aiCharges,
      totalEstimate: baseCharges + aiCharges,
    };
  }

  /**
   * Record call usage for billing.
   */
  async recordCallUsage(
    accountId: string,
    locationId: string | null,
    totalMinutes: number,
    aiMinutes: number,
    wasDispatched: boolean
  ): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    const records = await storage.getUsageRecords(accountId);
    
    let record = records.find(r => r.period === period && r.locationId === locationId);

    if (record) {
      await storage.updateUsageRecord(record.id, {
        totalMinutes: (record.totalMinutes || 0) + totalMinutes,
        aiMinutes: (record.aiMinutes || 0) + aiMinutes,
        totalCalls: (record.totalCalls || 0) + 1,
        dispatchActions: (record.dispatchActions || 0) + (wasDispatched ? 1 : 0),
      });
    } else {
      await storage.createUsageRecord({
        accountId,
        locationId,
        period,
        totalMinutes,
        aiMinutes,
        totalCalls: 1,
        incidentsHandled: 0,
        dispatchActions: wasDispatched ? 1 : 0,
      });
    }
  }

  /**
   * Record incident for billing.
   */
  async recordIncidentHandled(accountId: string, locationId: string | null): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    const records = await storage.getUsageRecords(accountId);
    
    let record = records.find(r => r.period === period && r.locationId === locationId);

    if (record) {
      await storage.updateUsageRecord(record.id, {
        incidentsHandled: (record.incidentsHandled || 0) + 1,
      });
    } else {
      await storage.createUsageRecord({
        accountId,
        locationId,
        period,
        totalMinutes: 0,
        aiMinutes: 0,
        totalCalls: 0,
        incidentsHandled: 1,
        dispatchActions: 0,
      });
    }
  }
}

export const billingService = new PointWakeBillingService();
