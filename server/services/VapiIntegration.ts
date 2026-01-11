/**
 * Vapi Voice AI Integration
 * 
 * Handles webhook events from Vapi for AI-powered voice conversations.
 * Vapi manages the conversation; this service handles business logic.
 * 
 * Flow:
 * 1. Twilio receives call to (844) 524-7683
 * 2. Twilio forwards to Vapi (configured in Vapi dashboard)
 * 3. Vapi calls our /webhooks/vapi/server-url endpoint
 * 4. We return dynamic assistant config with tools
 * 5. Vapi calls our tools when needed (check availability, schedule, transfer)
 * 6. For transfers, we route to Twilio Client identities (no personal phones)
 */

import { Request, Response } from "express";
import twilio from "twilio";
import { storage } from "../storage";
import { billingService } from "./BillingService";
import type { CallSession, Location, User, Account } from "@shared/schema";

const MAIN_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "+18445247683";
const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : process.env.BASE_URL || "http://localhost:5000";

// Active call tracking for real-time updates
interface ActiveVapiCall {
  callId: string;
  callSessionId: string;
  vapiCallId: string;
  accountId: string;
  locationId?: string;
  callerNumber: string;
  status: string;
  startedAt: Date;
  context: {
    callerName?: string;
    reason?: string;
    collectedData?: Record<string, any>;
  };
}

const activeVapiCalls = new Map<string, ActiveVapiCall>();

// WebSocket broadcast function (injected from routes.ts)
let broadcastFn: ((accountId: string, message: object) => void) | null = null;

export function setVapiBroadcast(fn: (accountId: string, message: object) => void) {
  broadcastFn = fn;
}

function broadcast(accountId: string, message: object) {
  if (broadcastFn) {
    broadcastFn(accountId, message);
  }
}

/**
 * Lookup account by the called phone number
 */
async function getAccountByPhoneNumber(phoneNumber: string): Promise<Account | null> {
  const accounts = await storage.getAccounts();
  for (const account of accounts) {
    if (account.mainPhoneNumber === phoneNumber) {
      return account;
    }
  }
  // Default to first account or demo account
  if (DEFAULT_ACCOUNT_ID) {
    return await storage.getAccount(DEFAULT_ACCOUNT_ID);
  }
  return accounts[0] || null;
}

/**
 * Get on-duty staff with app endpoints (Twilio Client identities)
 */
async function getAvailableStaff(accountId: string, locationId?: string): Promise<User[]> {
  const users = await storage.getUsers(accountId);
  return users.filter(user => 
    user.availability === "available" &&
    user.appEndpoint && // Must have Twilio Client registered
    (!locationId || user.locationId === locationId)
  );
}

/**
 * Build Twilio Client identity from user ID
 * Format: user_{userId} (NO "client:" prefix - Vapi adds it)
 */
function buildClientIdentity(userId: string): string {
  return `user_${userId}`;
}

// ============================================================
// VAPI WEBHOOK HANDLERS
// ============================================================

/**
 * Main Vapi Server URL endpoint
 * Vapi calls this for all events during a conversation
 */
export async function handleVapiServerUrl(req: Request, res: Response) {
  const event = req.body;
  const eventType = event.message?.type || event.type;
  
  console.log(`[Vapi] Event: ${eventType}`);
  
  try {
    switch (eventType) {
      case "assistant-request":
        return handleAssistantRequest(req, res, event);
        
      case "function-call":
        return handleFunctionCall(req, res, event);
        
      case "end-of-call-report":
        return handleEndOfCallReport(req, res, event);
        
      case "hang":
        return handleHangup(req, res, event);
        
      case "speech-update":
        return handleSpeechUpdate(req, res, event);
        
      case "transcript":
        return handleTranscript(req, res, event);
        
      case "status-update":
        return handleStatusUpdate(req, res, event);
        
      case "tool-calls":
        return handleToolCalls(req, res, event);
        
      default:
        console.log(`[Vapi] Unhandled event: ${eventType}`, JSON.stringify(event).slice(0, 500));
        return res.json({ success: true });
    }
  } catch (error) {
    console.error(`[Vapi] Error handling ${eventType}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle assistant-request: Return dynamic assistant configuration
 */
async function handleAssistantRequest(req: Request, res: Response, event: any) {
  const call = event.call || {};
  const callerNumber = call.customer?.number || "unknown";
  const calledNumber = call.phoneNumber?.number || MAIN_PHONE_NUMBER;
  const vapiCallId = call.id;
  
  console.log(`[Vapi] Assistant request: ${callerNumber} -> ${calledNumber}`);
  
  // Resolve account
  const account = await getAccountByPhoneNumber(calledNumber);
  
  if (!account) {
    console.error(`[Vapi] No account found for number: ${calledNumber}`);
    return res.json({
      assistant: {
        firstMessage: "I'm sorry, this number is not configured. Please call back later.",
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: "Apologize and hang up." }]
        },
        voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" }
      }
    });
  }
  
  // Create CallSession in our database
  let callSession: CallSession;
  try {
    callSession = await storage.createCallSession({
      accountId: account.id,
      callerNumber,
      aiAnswered: true,
      state: "AI_GREETING",
    });
  } catch (error) {
    console.error("[Vapi] Failed to create call session:", error);
    return res.status(500).json({ error: "Failed to create call session" });
  }
  
  // Track active call
  activeVapiCalls.set(vapiCallId, {
    callId: vapiCallId,
    callSessionId: callSession.id,
    vapiCallId,
    accountId: account.id,
    callerNumber,
    status: "ai_handling",
    startedAt: new Date(),
    context: {},
  });
  
  // Broadcast to dashboard
  broadcast(account.id, {
    type: "incoming_call",
    payload: {
      callSessionId: callSession.id,
      vapiCallId,
      from: callerNumber,
      accountName: account.name,
      timestamp: new Date().toISOString(),
    }
  });
  
  // Get locations for this account
  const locations = await storage.getLocations(account.id);
  const locationNames = locations.map(l => l.name).join(", ");
  
  // Build system prompt
  const systemPrompt = buildSystemPrompt(account, locations);
  
  // Return assistant configuration
  return res.json({
    assistant: {
      firstMessage: `Thank you for calling ${account.name}. How can I help you today?`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        tools: getVapiTools(),
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female
      },
      serverUrl: `${BASE_URL}/webhooks/vapi/server-url`,
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.4,
      endCallFunctionEnabled: true,
      recordingEnabled: true,
      metadata: {
        pointwakeCallSessionId: callSession.id,
        accountId: account.id,
      }
    }
  });
}

/**
 * Build system prompt for Vapi assistant
 */
function buildSystemPrompt(account: Account, locations: Location[]): string {
  const locationList = locations.map(l => {
    const aliases = l.spokenAliases?.join(", ") || "";
    return `- ${l.name}${aliases ? ` (also known as: ${aliases})` : ""}`;
  }).join("\n");
  
  return `You are a friendly and professional AI receptionist for ${account.name}.

CORE BEHAVIOR:
- Be warm, helpful, and conversational
- Keep responses concise (1-2 sentences for phone)
- Listen carefully and confirm understanding
- Ask clarifying questions when needed
- Never make up information - use the tools provided

WHAT YOU CAN DO:
1. Answer FAQs about the business
2. Schedule property viewings (use schedule_viewing tool)
3. Create maintenance/service requests (use create_incident tool)
4. Check availability and pricing (use check_availability tool)
5. Transfer to human staff when needed (use transfer_to_human tool)

WHEN TO TRANSFER TO HUMAN:
- Caller explicitly asks for a person/manager
- Billing disputes or payment issues
- Complex complaints
- Legal matters
- Emergencies requiring immediate human response
- After 2-3 failed attempts to help
- Caller sounds frustrated or upset

AVAILABLE LOCATIONS:
${locationList || "No specific locations configured"}

IMPORTANT RULES:
- You are on a PHONE CALL - be natural, don't read lists
- Never give out personal phone numbers
- Always use tools to take actions - don't just promise to do something
- Transfers go to the web app, not personal phones

Remember: Be helpful, be human, be honest.`;
}

/**
 * Define tools/functions Vapi can call
 */
function getVapiTools() {
  return [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check availability for apartments, services, or appointments. Use when caller asks about available units, pricing, or vacancy.",
        parameters: {
          type: "object",
          properties: {
            propertyType: {
              type: "string",
              description: "Type of property or service (apartment, studio, 1br, 2br, etc.)"
            },
            dateRange: {
              type: "string",
              description: "Desired date or date range if mentioned"
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "schedule_viewing",
        description: "Schedule a property viewing or appointment. Collect name, contact, and preferred time.",
        parameters: {
          type: "object",
          properties: {
            callerName: { type: "string", description: "Caller's full name" },
            callerPhone: { type: "string", description: "Caller's phone number (use their calling number if not provided)" },
            preferredDate: { type: "string", description: "Preferred date for viewing" },
            preferredTime: { type: "string", description: "Preferred time for viewing" },
            propertyPreference: { type: "string", description: "What type of property they want to see" },
            notes: { type: "string", description: "Any additional notes or requirements" }
          },
          required: ["callerName"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_incident",
        description: "Create a maintenance request, service ticket, or report an issue.",
        parameters: {
          type: "object",
          properties: {
            callerName: { type: "string", description: "Resident/caller's name" },
            unitNumber: { type: "string", description: "Apartment/unit number if applicable" },
            issueType: { 
              type: "string", 
              enum: ["hvac", "plumbing", "electrical", "appliance", "general", "locksmith", "pest_control"],
              description: "Type of maintenance issue"
            },
            description: { type: "string", description: "Description of the issue" },
            isEmergency: { type: "boolean", description: "Is this an emergency (flood, fire, gas leak, no heat in winter)?" },
            callerPhone: { type: "string", description: "Contact phone number" }
          },
          required: ["description"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "transfer_to_human",
        description: "Transfer the call to a human staff member. Use when caller requests human, or AI cannot help.",
        parameters: {
          type: "object",
          properties: {
            locationName: { type: "string", description: "Name of location to transfer to (if specific location requested)" },
            reason: { type: "string", description: "Reason for transfer (e.g., 'billing question', 'caller requested')" },
            urgency: { 
              type: "string",
              enum: ["low", "normal", "urgent", "emergency"],
              description: "Urgency level"
            }
          },
          required: ["reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "answer_faq",
        description: "Look up answer to a frequently asked question.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question to look up" },
            category: { type: "string", description: "Category of question (hours, pricing, policies, location)" }
          },
          required: ["question"]
        }
      }
    }
  ];
}

/**
 * Handle function/tool calls from Vapi
 */
async function handleFunctionCall(req: Request, res: Response, event: any) {
  const functionCall = event.message?.functionCall || event.functionCall;
  const call = event.call || {};
  const metadata = call.metadata || {};
  
  const callSessionId = metadata.pointwakeCallSessionId;
  const accountId = metadata.accountId;
  const functionName = functionCall?.name;
  const parameters = functionCall?.parameters || {};
  
  console.log(`[Vapi] Function call: ${functionName}`, parameters);
  
  if (!functionName) {
    return res.json({ result: "No function specified" });
  }
  
  let result: any;
  
  try {
    switch (functionName) {
      case "check_availability":
        result = await handleCheckAvailability(accountId, parameters);
        break;
        
      case "schedule_viewing":
        result = await handleScheduleViewing(accountId, callSessionId, call.customer?.number, parameters);
        break;
        
      case "create_incident":
        result = await handleCreateIncident(accountId, callSessionId, call.customer?.number, parameters);
        break;
        
      case "transfer_to_human":
        result = await handleTransferToHuman(accountId, callSessionId, call.id, parameters);
        break;
        
      case "answer_faq":
        result = await handleAnswerFaq(accountId, parameters);
        break;
        
      default:
        result = { success: false, message: "Unknown function" };
    }
    
    // Update call session with intent
    if (callSessionId) {
      await storage.updateCallSession(callSessionId, {
        intent: functionName,
        state: "AI_ACTION_EXECUTION",
      });
    }
    
    return res.json({ result: JSON.stringify(result) });
    
  } catch (error) {
    console.error(`[Vapi] Function ${functionName} error:`, error);
    return res.json({ 
      result: JSON.stringify({ 
        success: false, 
        message: "I encountered an error. Let me transfer you to someone who can help." 
      }) 
    });
  }
}

/**
 * Handle tool-calls event (newer Vapi format)
 */
async function handleToolCalls(req: Request, res: Response, event: any) {
  const toolCalls = event.message?.toolCalls || event.toolCalls || [];
  const call = event.call || {};
  const metadata = call.metadata || {};
  
  const results = [];
  
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function?.name;
    const parameters = toolCall.function?.arguments ? 
      JSON.parse(toolCall.function.arguments) : {};
    
    console.log(`[Vapi] Tool call: ${functionName}`, parameters);
    
    let result: any;
    
    try {
      switch (functionName) {
        case "check_availability":
          result = await handleCheckAvailability(metadata.accountId, parameters);
          break;
        case "schedule_viewing":
          result = await handleScheduleViewing(metadata.accountId, metadata.pointwakeCallSessionId, call.customer?.number, parameters);
          break;
        case "create_incident":
          result = await handleCreateIncident(metadata.accountId, metadata.pointwakeCallSessionId, call.customer?.number, parameters);
          break;
        case "transfer_to_human":
          result = await handleTransferToHuman(metadata.accountId, metadata.pointwakeCallSessionId, call.id, parameters);
          break;
        case "answer_faq":
          result = await handleAnswerFaq(metadata.accountId, parameters);
          break;
        default:
          result = { success: false, message: "Unknown function" };
      }
    } catch (error) {
      console.error(`[Vapi] Tool ${functionName} error:`, error);
      result = { success: false, message: "Error executing tool" };
    }
    
    results.push({
      toolCallId: toolCall.id,
      result: JSON.stringify(result)
    });
  }
  
  return res.json({ results });
}

// ============================================================
// TOOL IMPLEMENTATIONS
// ============================================================

async function handleCheckAvailability(accountId: string, params: any) {
  // TODO: Replace with real property/availability data
  const propertyType = params.propertyType?.toLowerCase() || "any";
  
  const availability = {
    studio: { available: 2, priceRange: "$950 - $1,050/mo", moveIn: "Available now" },
    "1br": { available: 5, priceRange: "$1,100 - $1,300/mo", moveIn: "Feb 1" },
    "2br": { available: 3, priceRange: "$1,400 - $1,650/mo", moveIn: "Feb 15" },
    "3br": { available: 1, priceRange: "$1,800 - $2,100/mo", moveIn: "Mar 1" },
  };
  
  if (propertyType === "any" || !availability[propertyType as keyof typeof availability]) {
    return {
      success: true,
      message: "We have availability! Studios start at $950, one bedrooms from $1,100, two bedrooms from $1,400. Would you like to schedule a tour?"
    };
  }
  
  const unit = availability[propertyType as keyof typeof availability];
  return {
    success: true,
    available: unit.available,
    priceRange: unit.priceRange,
    moveInDate: unit.moveIn,
    message: `We have ${unit.available} ${propertyType} units available, ${unit.priceRange}. Next available move-in is ${unit.moveIn}. Would you like to schedule a viewing?`
  };
}

async function handleScheduleViewing(
  accountId: string, 
  callSessionId: string | undefined,
  callerPhone: string | undefined,
  params: any
) {
  if (!accountId) {
    return { success: false, message: "Unable to process request" };
  }
  
  // Create incident as a viewing request
  const incident = await storage.createIncident({
    accountId,
    trade: "general",
    severity: "normal",
    callerPhone: params.callerPhone || callerPhone,
    callerName: params.callerName,
    summary: `Viewing Request - ${params.callerName || "Caller"}`,
    description: `Property preference: ${params.propertyPreference || "Not specified"}\n` +
      `Preferred date: ${params.preferredDate || "Flexible"}\n` +
      `Preferred time: ${params.preferredTime || "Flexible"}\n` +
      `Notes: ${params.notes || "None"}`,
    status: "open",
    auditLog: [{
      timestamp: new Date().toISOString(),
      action: "Viewing scheduled via AI",
      details: `Caller: ${params.callerName || "Unknown"}`,
    }]
  });
  
  // Update call session
  if (callSessionId) {
    await storage.updateCallSession(callSessionId, {
      intent: "schedule_viewing",
      incidentId: incident.id,
      outcome: "ai_resolved",
    });
  }
  
  // Broadcast to dashboard
  if (accountId) {
    broadcast(accountId, {
      type: "new_incident",
      payload: {
        id: incident.id,
        type: "viewing",
        summary: `Viewing: ${params.callerName || "Caller"}`,
        timestamp: new Date().toISOString(),
      }
    });
  }
  
  return {
    success: true,
    incidentId: incident.id,
    message: `I've scheduled your viewing request for ${params.callerName}. Our team will call you back to confirm the exact time. Is there anything else I can help with?`
  };
}

async function handleCreateIncident(
  accountId: string,
  callSessionId: string | undefined,
  callerPhone: string | undefined,
  params: any
) {
  if (!accountId) {
    return { success: false, message: "Unable to process request" };
  }
  
  const severity = params.isEmergency ? "emergency" : "normal";
  const trade = params.issueType || "general";
  
  const incident = await storage.createIncident({
    accountId,
    trade,
    severity,
    callerPhone: params.callerPhone || callerPhone,
    callerName: params.callerName,
    summary: `${trade.toUpperCase()} - ${params.description?.slice(0, 100) || "Maintenance Request"}`,
    description: `Issue: ${params.description}\nUnit: ${params.unitNumber || "Not specified"}\nEmergency: ${params.isEmergency ? "YES" : "No"}`,
    status: "open",
    auditLog: [{
      timestamp: new Date().toISOString(),
      action: "Incident created via AI",
      details: `Trade: ${trade}, Severity: ${severity}`,
    }]
  });
  
  // Update call session
  if (callSessionId) {
    await storage.updateCallSession(callSessionId, {
      intent: params.isEmergency ? "emergency" : "maintenance_request",
      trade,
      severity,
      incidentId: incident.id,
      outcome: params.isEmergency ? "needs_transfer" : "ai_resolved",
    });
  }
  
  // Broadcast
  broadcast(accountId, {
    type: "new_incident",
    payload: {
      id: incident.id,
      type: "maintenance",
      summary: incident.summary,
      severity,
      isEmergency: params.isEmergency,
      timestamp: new Date().toISOString(),
    }
  });
  
  if (params.isEmergency) {
    return {
      success: true,
      requiresTransfer: true,
      incidentId: incident.id,
      message: "I've logged this as an emergency maintenance request. Let me transfer you to someone who can help immediately."
    };
  }
  
  return {
    success: true,
    incidentId: incident.id,
    message: `I've submitted your maintenance request. Your reference number is ${incident.id.slice(-6).toUpperCase()}. Our maintenance team will contact you within 24 hours. Is there anything else?`
  };
}

async function handleTransferToHuman(
  accountId: string,
  callSessionId: string | undefined,
  vapiCallId: string | undefined,
  params: any
) {
  if (!accountId) {
    return { success: false, message: "Unable to transfer" };
  }
  
  // Find target location if specified
  let locationId: string | undefined;
  if (params.locationName) {
    const locations = await storage.getLocations(accountId);
    const location = locations.find(l => 
      l.name.toLowerCase().includes(params.locationName.toLowerCase()) ||
      l.spokenAliases?.some(a => a.toLowerCase().includes(params.locationName.toLowerCase()))
    );
    locationId = location?.id;
  }
  
  // Get available staff with Twilio Client endpoints
  const availableStaff = await getAvailableStaff(accountId, locationId);
  
  if (availableStaff.length === 0) {
    // No one available
    if (callSessionId) {
      await storage.updateCallSession(callSessionId, {
        state: "FALLBACK",
        outcome: "no_staff_available",
      });
    }
    
    return {
      success: false,
      noAgentsAvailable: true,
      message: "I apologize, but all of our team members are currently unavailable. Would you like to leave a voicemail and have someone call you back?"
    };
  }
  
  // Update call session
  if (callSessionId) {
    await storage.updateCallSession(callSessionId, {
      state: "ROUTING_TO_HUMAN",
      outcome: "transferred",
    });
  }
  
  // Build transfer destinations (Twilio Client identities)
  const clientIdentities = availableStaff.map(u => buildClientIdentity(u.id));
  
  // Broadcast incoming transfer to staff
  broadcast(accountId, {
    type: "incoming_transfer",
    payload: {
      callSessionId,
      vapiCallId,
      reason: params.reason,
      urgency: params.urgency || "normal",
      locationId,
      staffCount: availableStaff.length,
      timestamp: new Date().toISOString(),
    }
  });
  
  // Return transfer info to Vapi
  // Vapi will use this to perform the transfer
  return {
    success: true,
    transfer: true,
    type: "dial",
    destination: clientIdentities[0], // Primary target
    numberE164Plus: null, // No phone numbers - Twilio Client only
    sipUri: null,
    clientIdentity: clientIdentities[0],
    allClientIdentities: clientIdentities,
    message: "Transferring you now. One moment please."
  };
}

async function handleAnswerFaq(accountId: string, params: any) {
  // TODO: Implement knowledge base lookup
  // For now, return generic responses
  
  const faqs: Record<string, string> = {
    hours: "Our office is open Monday through Friday, 9 AM to 5 PM. We're closed on weekends and holidays.",
    location: "We're located in the main office building. The address is on our website.",
    parking: "We offer free parking for residents and guests.",
    pets: "We are pet-friendly! Dogs and cats are welcome with a pet deposit.",
    utilities: "Water and trash are included. Residents pay for electricity and gas.",
    lease: "We offer 12-month leases. Shorter terms may be available at a premium.",
  };
  
  const category = params.category?.toLowerCase();
  const answer = faqs[category];
  
  if (answer) {
    return { success: true, answer };
  }
  
  return {
    success: true,
    answer: "I don't have specific information about that. Would you like me to transfer you to someone who can help?"
  };
}

// ============================================================
// CALL LIFECYCLE EVENTS
// ============================================================

async function handleEndOfCallReport(req: Request, res: Response, event: any) {
  const call = event.call || {};
  const metadata = call.metadata || {};
  const callSessionId = metadata.pointwakeCallSessionId;
  const summary = event.summary || call.summary;
  const transcript = event.transcript || call.transcript;
  const recordingUrl = event.recordingUrl || call.recordingUrl;
  const durationMinutes = (call.endedAt && call.startedAt) 
    ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 60000
    : 0;
  
  console.log(`[Vapi] Call ended: ${callSessionId}, duration: ${durationMinutes.toFixed(2)} min`);
  
  if (callSessionId) {
    await storage.updateCallSession(callSessionId, {
      state: "ENDED",
      endTime: new Date(),
      totalMinutes: durationMinutes,
      aiMinutes: durationMinutes, // AI handled whole call
      transcript: typeof transcript === "string" ? transcript : JSON.stringify(transcript),
      billableAmount: durationMinutes * 0.15, // $0.15/min
    });
    
    // Update usage record
    const callSession = await storage.getCallSession(callSessionId);
    if (callSession) {
      await billingService.recordUsage({
        accountId: callSession.accountId,
        totalMinutes: durationMinutes,
        aiMinutes: durationMinutes,
        totalCalls: 1,
        incidentsHandled: callSession.incidentId ? 1 : 0,
        dispatchActions: 0,
      });
      
      broadcast(callSession.accountId, {
        type: "call_ended",
        payload: {
          callSessionId,
          duration: durationMinutes,
          outcome: callSession.outcome || "completed",
        }
      });
    }
  }
  
  // Clean up tracking
  activeVapiCalls.delete(call.id);
  
  return res.json({ success: true });
}

async function handleHangup(req: Request, res: Response, event: any) {
  const call = event.call || {};
  const metadata = call.metadata || {};
  const callSessionId = metadata.pointwakeCallSessionId;
  
  console.log(`[Vapi] Caller hung up: ${callSessionId}`);
  
  if (callSessionId) {
    await storage.updateCallSession(callSessionId, {
      state: "ENDED",
      endTime: new Date(),
      outcome: "caller_hangup",
    });
  }
  
  activeVapiCalls.delete(call.id);
  
  return res.json({ success: true });
}

async function handleSpeechUpdate(req: Request, res: Response, event: any) {
  // Real-time speech updates (for live transcription display)
  const role = event.role;
  const text = event.text;
  const call = event.call || {};
  const metadata = call.metadata || {};
  
  if (metadata.accountId) {
    broadcast(metadata.accountId, {
      type: "speech_update",
      payload: {
        callSessionId: metadata.pointwakeCallSessionId,
        role,
        text,
      }
    });
  }
  
  return res.json({ success: true });
}

async function handleTranscript(req: Request, res: Response, event: any) {
  // Full transcript update
  const transcript = event.transcript;
  const call = event.call || {};
  const metadata = call.metadata || {};
  const callSessionId = metadata.pointwakeCallSessionId;
  
  if (callSessionId && transcript) {
    // Could save incremental transcript here
  }
  
  return res.json({ success: true });
}

async function handleStatusUpdate(req: Request, res: Response, event: any) {
  const status = event.status;
  const call = event.call || {};
  const metadata = call.metadata || {};
  
  console.log(`[Vapi] Status: ${status}`, metadata.pointwakeCallSessionId);
  
  return res.json({ success: true });
}

// ============================================================
// UTILITY ENDPOINTS
// ============================================================

/**
 * Get active calls for dashboard
 */
export async function getActiveVapiCalls(req: Request, res: Response) {
  const user = req.user as any;
  const accountId = user?.accountId;
  
  if (!accountId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const calls = Array.from(activeVapiCalls.values())
    .filter(c => c.accountId === accountId);
  
  return res.json({ calls });
}

/**
 * Health check for Vapi configuration
 */
export async function checkVapiHealth(req: Request, res: Response) {
  const checks = {
    vapiApiKey: !!VAPI_API_KEY,
    twilioNumber: !!MAIN_PHONE_NUMBER,
    baseUrl: BASE_URL,
    activeCalls: activeVapiCalls.size,
  };
  
  return res.json(checks);
}
