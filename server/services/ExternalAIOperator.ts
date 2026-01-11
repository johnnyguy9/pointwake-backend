/**
 * External AI Operator Interface
 * 
 * This module provides webhook endpoints for integrating with an external AI voice agent.
 * The external AI handles conversation/scheduling, and calls back to PointWake for:
 * - Location identification
 * - Staff routing/transfer
 * - Call logging
 * 
 * Webhook Contract:
 * 
 * 1. INBOUND CALL NOTIFICATION (PointWake -> External AI)
 *    POST to configured webhook URL with:
 *    {
 *      callSessionId: string,
 *      callSid: string,
 *      callerNumber: string,
 *      calledNumber: string,
 *      accountId: string,
 *      timestamp: string
 *    }
 * 
 * 2. TRANSFER REQUEST (External AI -> PointWake)
 *    POST /api/operator/transfer
 *    {
 *      callSessionId: string,
 *      callSid: string,
 *      locationName: string,      // spoken name or alias
 *      callerContext: {           // info to whisper to staff
 *        callerName?: string,
 *        reason?: string,
 *        urgency?: "low" | "normal" | "urgent" | "emergency"
 *      }
 *    }
 * 
 * 3. CALL END NOTIFICATION (External AI -> PointWake)
 *    POST /api/operator/call-ended
 *    {
 *      callSessionId: string,
 *      callSid: string,
 *      outcome: string,
 *      transcript?: string,
 *      summary?: string
 *    }
 */

import { Request, Response } from "express";
import { storage } from "../storage";
import { telephonyAdapter, VoiceResponse } from "./TelephonyAdapter";
import type { Location, User, CallSession } from "@shared/schema";

const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID || "acc-demo-001";

/**
 * Lookup account by the called phone number
 * In production, accounts would have phone numbers assigned
 */
async function getAccountByCalledNumber(calledNumber: string): Promise<string> {
  const accounts = await storage.getAccounts();
  for (const account of accounts) {
    if (account.mainPhoneNumber === calledNumber) {
      return account.id;
    }
  }
  return DEFAULT_ACCOUNT_ID;
}

interface TransferRequest {
  callSessionId: string;
  callSid: string;
  locationName: string;
  callerContext?: {
    callerName?: string;
    reason?: string;
    urgency?: "low" | "normal" | "urgent" | "emergency";
  };
}

interface CallEndedRequest {
  callSessionId: string;
  callSid: string;
  outcome: string;
  transcript?: string;
  summary?: string;
}

/**
 * Find location by spoken name or alias
 */
async function findLocationByName(accountId: string, locationName: string): Promise<Location | null> {
  const locations = await storage.getLocations(accountId);
  const normalizedName = locationName.toLowerCase().trim();
  
  for (const location of locations) {
    if (location.name.toLowerCase() === normalizedName) {
      return location;
    }
    if (location.spokenAliases) {
      for (const alias of location.spokenAliases) {
        if (alias.toLowerCase() === normalizedName) {
          return location;
        }
      }
    }
  }
  
  for (const location of locations) {
    if (location.name.toLowerCase().includes(normalizedName) || 
        normalizedName.includes(location.name.toLowerCase())) {
      return location;
    }
    if (location.spokenAliases) {
      for (const alias of location.spokenAliases) {
        if (alias.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(alias.toLowerCase())) {
          return location;
        }
      }
    }
  }
  
  return null;
}

/**
 * Find on-duty staff for a location
 */
async function findOnDutyStaff(accountId: string, locationId: string): Promise<User[]> {
  const users = await storage.getUsers(accountId);
  return users.filter(user => 
    user.locationId === locationId && 
    user.availability === "available" &&
    (user.appEndpoint || user.phoneNumber)
  );
}

/**
 * Build whisper message for staff
 */
function buildWhisperMessage(callerContext?: TransferRequest["callerContext"]): string {
  if (!callerContext) {
    return "Incoming call transferred from AI assistant.";
  }
  
  const parts: string[] = [];
  
  if (callerContext.urgency === "emergency") {
    parts.push("Emergency call.");
  } else if (callerContext.urgency === "urgent") {
    parts.push("Urgent call.");
  }
  
  if (callerContext.callerName) {
    parts.push(`Caller: ${callerContext.callerName}.`);
  }
  
  if (callerContext.reason) {
    parts.push(`Reason: ${callerContext.reason}.`);
  }
  
  return parts.length > 0 ? parts.join(" ") : "Incoming call transferred from AI assistant.";
}

/**
 * Handle incoming call - creates session and notifies external AI
 */
export async function handleExternalAIIncomingCall(req: Request, res: Response) {
  const callSid = req.body.CallSid;
  const callerPhone = req.body.From;
  const calledNumber = req.body.To;

  console.log(`[External AI] Incoming call: ${callSid} from ${callerPhone} to ${calledNumber}`);

  const accountId = await getAccountByCalledNumber(calledNumber);
  console.log(`[External AI] Resolved to account: ${accountId}`);

  let callSession;
  try {
    callSession = await storage.createCallSession({
      accountId,
      callerNumber: callerPhone,
      aiAnswered: true,
      state: "INBOUND_RECEIVED",
    });
  } catch (error) {
    console.error("[External AI] Failed to create call session:", error);
    const response = new VoiceResponse();
    response.say({ voice: "alice" }, "We're experiencing technical difficulties. Please try again later.");
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }

  const externalAIWebhook = process.env.EXTERNAL_AI_WEBHOOK_URL;
  
  if (externalAIWebhook) {
    try {
      const locations = await storage.getLocations(accountId);
      const account = await storage.getAccount(accountId);
      
      await fetch(externalAIWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSessionId: callSession.id,
          callSid,
          callerNumber: callerPhone,
          calledNumber,
          accountId,
          accountName: account?.name,
          availableLocations: locations.map(l => ({
            id: l.id,
            name: l.name,
            aliases: l.spokenAliases,
          })),
          timestamp: new Date().toISOString(),
        }),
      });
      console.log(`[External AI] Notified webhook: ${externalAIWebhook}`);
    } catch (error) {
      console.error("[External AI] Failed to notify webhook:", error);
    }
  }

  const response = new VoiceResponse();
  
  const externalAITwimlUrl = process.env.EXTERNAL_AI_TWIML_URL;
  if (externalAITwimlUrl) {
    response.redirect(externalAITwimlUrl + `?callSessionId=${callSession.id}`);
  } else {
    response.say({ voice: "alice" }, 
      "Thank you for calling. Please hold while we connect you to an assistant."
    );
    response.pause({ length: 2 });
    response.say({ voice: "alice" }, 
      "We're sorry, the AI assistant is not available. Please try again later."
    );
    response.hangup();
  }

  res.type("text/xml");
  res.send(response.toString());
}

/**
 * Handle transfer request from external AI
 */
export async function handleTransferRequest(req: Request, res: Response) {
  const { callSessionId, callSid, locationName, callerContext }: TransferRequest = req.body;

  console.log(`[External AI] Transfer request: ${callSid} to location "${locationName}"`);

  if (!callSessionId || !callSid || !locationName) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required fields: callSessionId, callSid, locationName" 
    });
  }

  const callSession = await storage.getCallSession(callSessionId);
  if (!callSession) {
    return res.status(404).json({ success: false, error: "Call session not found" });
  }

  const accountId = callSession.accountId || DEFAULT_ACCOUNT_ID;

  const location = await findLocationByName(accountId, locationName);
  if (!location) {
    console.log(`[External AI] Location not found: "${locationName}"`);
    return res.json({ 
      success: false, 
      error: "Location not found",
      availableLocations: (await storage.getLocations(accountId)).map(l => l.name)
    });
  }

  const onDutyStaff = await findOnDutyStaff(accountId, location.id);
  if (onDutyStaff.length === 0) {
    console.log(`[External AI] No on-duty staff at location: ${location.name}`);
    
    await storage.updateCallSession(callSessionId, {
      state: "FALLBACK",
      outcome: "no_staff_available",
    });
    
    return res.json({ 
      success: false, 
      error: "No staff available at this location",
      locationName: location.name,
      afterHoursPolicy: location.afterHoursPolicy
    });
  }

  await storage.updateCallSession(callSessionId, {
    state: "ROUTING_TO_HUMAN",
  });

  const whisperMessage = buildWhisperMessage(callerContext);
  const staffEndpoints = onDutyStaff.map(u => u.appEndpoint || u.phoneNumber).filter(Boolean) as string[];

  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "http://localhost:5000";
    
    const transferUrl = `${baseUrl}/api/operator/transfer-connect?` + 
      `callSessionId=${callSessionId}&` +
      `locationId=${location.id}&` +
      `whisper=${encodeURIComponent(whisperMessage)}&` +
      `endpoints=${encodeURIComponent(staffEndpoints.join(","))}`;

    const client = await import("twilio").then(m => m.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    ));
    
    await client.calls(callSid).update({
      url: transferUrl,
      method: "POST",
    });

    console.log(`[External AI] Transferring to ${staffEndpoints.length} staff at ${location.name}`);

    return res.json({ 
      success: true, 
      locationName: location.name,
      staffCount: onDutyStaff.length,
      message: "Transfer initiated"
    });

  } catch (error) {
    console.error("[External AI] Transfer failed:", error);
    return res.status(500).json({ success: false, error: "Transfer failed" });
  }
}

/**
 * TwiML endpoint for connecting transferred call
 */
export async function handleTransferConnect(req: Request, res: Response) {
  const callSessionId = req.query.callSessionId as string;
  const locationId = req.query.locationId as string;
  const whisperMessage = decodeURIComponent(req.query.whisper as string || "");
  const endpoints = (req.query.endpoints as string || "").split(",").filter(Boolean);

  console.log(`[External AI] Transfer connect: ${endpoints.length} endpoints`);

  const response = new VoiceResponse();

  if (endpoints.length === 0) {
    response.say({ voice: "alice" }, "Sorry, no staff are available at this location. Please try again later.");
    response.hangup();
  } else {
    response.say({ voice: "alice" }, "Connecting you now. Please hold.");
    
    const dial = response.dial({
      timeout: 30,
      action: `/api/operator/transfer-status?callSessionId=${callSessionId}`,
      method: "POST",
    });

    for (const endpoint of endpoints) {
      if (endpoint.startsWith("client:")) {
        dial.client({}, endpoint.replace("client:", ""));
      } else {
        dial.number({
          statusCallback: `/api/operator/staff-status?callSessionId=${callSessionId}`,
          statusCallbackMethod: "POST",
        }, endpoint);
      }
    }
  }

  await storage.updateCallSession(callSessionId, {
    state: "RINGING_USERS",
  });

  res.type("text/xml");
  res.send(response.toString());
}

/**
 * Handle transfer status callback
 */
export async function handleTransferStatus(req: Request, res: Response) {
  const callSessionId = req.query.callSessionId as string;
  const dialCallStatus = req.body.DialCallStatus;
  const dialCallDuration = req.body.DialCallDuration;

  console.log(`[External AI] Transfer status: ${dialCallStatus} (${dialCallDuration}s)`);

  const response = new VoiceResponse();

  if (dialCallStatus === "completed" || dialCallStatus === "answered") {
    await storage.updateCallSession(callSessionId, {
      state: "CONNECTED",
      totalMinutes: parseFloat(dialCallDuration) / 60 || 0,
    });
  } else if (dialCallStatus === "busy" || dialCallStatus === "no-answer" || dialCallStatus === "failed") {
    await storage.updateCallSession(callSessionId, {
      state: "FALLBACK",
      outcome: `transfer_${dialCallStatus}`,
    });
    
    response.say({ voice: "alice" }, 
      "Sorry, we couldn't connect you to staff at this time. Please leave a message after the tone, or call back later."
    );
    response.record({
      maxLength: 120,
      action: `/api/operator/voicemail?callSessionId=${callSessionId}`,
      method: "POST",
    });
  }

  res.type("text/xml");
  res.send(response.toString());
}

/**
 * Handle voicemail recording
 */
export async function handleVoicemail(req: Request, res: Response) {
  const callSessionId = req.query.callSessionId as string;
  const recordingUrl = req.body.RecordingUrl;
  const recordingDuration = req.body.RecordingDuration;

  console.log(`[External AI] Voicemail recorded: ${recordingUrl} (${recordingDuration}s)`);

  await storage.updateCallSession(callSessionId, {
    state: "ENDED",
    outcome: "voicemail",
    transcript: `Voicemail: ${recordingUrl}`,
  });

  const response = new VoiceResponse();
  response.say({ voice: "alice" }, "Thank you for your message. Goodbye.");
  response.hangup();

  res.type("text/xml");
  res.send(response.toString());
}

/**
 * Handle call ended notification from external AI
 */
export async function handleCallEnded(req: Request, res: Response) {
  const { callSessionId, callSid, outcome, transcript, summary }: CallEndedRequest = req.body;

  console.log(`[External AI] Call ended: ${callSid} - ${outcome}`);

  if (!callSessionId) {
    return res.status(400).json({ success: false, error: "Missing callSessionId" });
  }

  try {
    await storage.updateCallSession(callSessionId, {
      state: "ENDED",
      outcome,
      transcript,
      endTime: new Date(),
    });

    const callSession = await storage.getCallSession(callSessionId);
    if (callSession && callSession.startTime) {
      const durationMs = new Date().getTime() - new Date(callSession.startTime).getTime();
      const totalMinutes = durationMs / 60000;
      
      await storage.updateCallSession(callSessionId, {
        totalMinutes,
        billableAmount: totalMinutes * 0.15,
      });

      await storage.createUsageRecord({
        accountId: callSession.accountId || DEFAULT_ACCOUNT_ID,
        period: new Date().toISOString().slice(0, 7),
        totalMinutes,
        aiMinutes: totalMinutes,
        incidentsHandled: 0,
        dispatchActions: 0,
        totalCalls: 1,
      });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("[External AI] Failed to update call session:", error);
    return res.status(500).json({ success: false, error: "Failed to update call session" });
  }
}

/**
 * Get available locations for the account
 */
export async function getAvailableLocations(req: Request, res: Response) {
  const user = req.user as any;
  const accountId = user?.accountId || req.query.accountId as string || DEFAULT_ACCOUNT_ID;
  
  try {
    const locations = await storage.getLocations(accountId);
    const locationsWithStaff = await Promise.all(
      locations.map(async (location) => {
        const staff = await findOnDutyStaff(accountId, location.id);
        return {
          id: location.id,
          name: location.name,
          spokenAliases: location.spokenAliases,
          hasStaffAvailable: staff.length > 0,
          staffCount: staff.length,
          businessHours: {
            start: location.businessHoursStart,
            end: location.businessHoursEnd,
          },
          timezone: location.timezone,
        };
      })
    );
    
    return res.json({ locations: locationsWithStaff });
    
  } catch (error) {
    console.error("[External AI] Failed to get locations:", error);
    return res.status(500).json({ error: "Failed to get locations" });
  }
}

/**
 * Get call session info
 */
export async function getCallSessionInfo(req: Request, res: Response) {
  const callSessionId = req.params.callSessionId;
  
  try {
    const callSession = await storage.getCallSession(callSessionId);
    if (!callSession) {
      return res.status(404).json({ error: "Call session not found" });
    }
    
    return res.json(callSession);
    
  } catch (error) {
    console.error("[External AI] Failed to get call session:", error);
    return res.status(500).json({ error: "Failed to get call session" });
  }
}
