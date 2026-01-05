/**
 * Call History and Interaction Logging Service
 * 
 * Tracks all calls, transcripts, and staff handoffs
 */

import { Request, Response } from "express";
import { storage } from "../storage";
import type { CallSession } from "@shared/schema";

interface CallHistoryFilters {
  startDate?: string;
  endDate?: string;
  locationId?: string;
  staffId?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get call history with filters
 */
export async function getCallHistory(req: Request, res: Response) {
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const filters: CallHistoryFilters = {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    locationId: req.query.locationId as string,
    staffId: req.query.staffId as string,
    outcome: req.query.outcome as string,
    limit: parseInt(req.query.limit as string) || 50,
    offset: parseInt(req.query.offset as string) || 0,
  };

  try {
    const allSessions = await storage.getCallSessions(user.accountId);
    
    let filtered = allSessions;

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      filtered = filtered.filter(s => s.startTime && new Date(s.startTime) >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      filtered = filtered.filter(s => s.startTime && new Date(s.startTime) <= end);
    }

    if (filters.outcome) {
      filtered = filtered.filter(s => s.outcome === filters.outcome);
    }

    filtered.sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
      return bTime - aTime;
    });

    const total = filtered.length;
    const paged = filtered.slice(filters.offset!, filters.offset! + filters.limit!);

    const callHistory = paged.map(session => ({
      id: session.id,
      callerNumber: session.callerNumber,
      startTime: session.startTime,
      endTime: session.endTime,
      totalMinutes: session.totalMinutes,
      state: session.state,
      outcome: session.outcome,
      aiAnswered: session.aiAnswered,
      hasTranscript: !!session.transcript,
    }));

    return res.json({
      calls: callHistory,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });

  } catch (error) {
    console.error("[CallHistory] Failed to get history:", error);
    return res.status(500).json({ error: "Failed to get call history" });
  }
}

/**
 * Get call details including transcript
 */
export async function getCallDetails(req: Request, res: Response) {
  const user = req.user as any;
  const callId = req.params.callId;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const session = await storage.getCallSession(callId);
    
    if (!session) {
      return res.status(404).json({ error: "Call not found" });
    }

    if (session.accountId !== user.accountId && user.role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      id: session.id,
      callerNumber: session.callerNumber,
      startTime: session.startTime,
      endTime: session.endTime,
      totalMinutes: session.totalMinutes,
      aiMinutes: session.aiMinutes,
      state: session.state,
      outcome: session.outcome,
      aiAnswered: session.aiAnswered,
      propertyId: session.propertyId,
      unitId: session.unitId,
      incidentId: session.incidentId,
      transcript: session.transcript,
      billableAmount: session.billableAmount,
    });

  } catch (error) {
    console.error("[CallHistory] Failed to get call details:", error);
    return res.status(500).json({ error: "Failed to get call details" });
  }
}

/**
 * Get call statistics/summary
 */
export async function getCallStats(req: Request, res: Response) {
  const user = req.user as any;
  const period = req.query.period as string || "today";

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const allSessions = await storage.getCallSessions(user.accountId);
    
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0);
    }

    const filtered = allSessions.filter(s => 
      s.startTime && new Date(s.startTime) >= startDate
    );

    const totalCalls = filtered.length;
    const totalMinutes = filtered.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
    const aiMinutes = filtered.reduce((sum, s) => sum + (s.aiMinutes || 0), 0);
    
    const completedCalls = filtered.filter(s => s.state === "ENDED" || s.state === "CONNECTED").length;
    const missedCalls = filtered.filter(s => s.outcome === "no_answer" || s.outcome === "no_staff_available").length;
    const voicemails = filtered.filter(s => s.outcome === "voicemail").length;

    const avgDuration = totalCalls > 0 ? totalMinutes / totalCalls : 0;

    return res.json({
      period,
      totalCalls,
      completedCalls,
      missedCalls,
      voicemails,
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      aiMinutes: Math.round(aiMinutes * 100) / 100,
      avgDurationMinutes: Math.round(avgDuration * 100) / 100,
      answerRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
    });

  } catch (error) {
    console.error("[CallHistory] Failed to get stats:", error);
    return res.status(500).json({ error: "Failed to get stats" });
  }
}

/**
 * Export call history as CSV
 */
export async function exportCallHistory(req: Request, res: Response) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!["account_admin", "manager", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  try {
    const allSessions = await storage.getCallSessions(user.accountId);
    
    const headers = [
      "Call ID",
      "Caller Number", 
      "Start Time",
      "End Time",
      "Duration (min)",
      "State",
      "Outcome",
      "AI Answered",
    ];

    const rows = allSessions.map(s => [
      s.id,
      s.callerNumber,
      s.startTime?.toISOString() || "",
      s.endTime?.toISOString() || "",
      (s.totalMinutes || 0).toFixed(2),
      s.state,
      s.outcome || "",
      s.aiAnswered ? "Yes" : "No",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=call-history-${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csv);

  } catch (error) {
    console.error("[CallHistory] Failed to export:", error);
    return res.status(500).json({ error: "Failed to export" });
  }
}
