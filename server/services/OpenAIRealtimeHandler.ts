import WebSocket from "ws";
import { storage } from "../storage";
import { rulesEngine } from "./RulesEngine";
import { dispatchService } from "./DispatchService";
import { telephonyAdapter } from "./TelephonyAdapter";
import type { CallSession } from "@shared/schema";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

const SYSTEM_PROMPT = `You are Alex, an AI receptionist for PointWake property management services. Your role is to help callers report maintenance issues and emergencies.

CONVERSATION FLOW:
1. Greet the caller warmly and ask how you can help
2. Identify the property name or address
3. Get the unit number if applicable
4. Understand the issue - ask clarifying questions if needed
5. Classify the urgency (emergency, urgent, normal, low)
6. Confirm details and dispatch appropriate vendor
7. Provide confirmation and estimated response time

IMPORTANT GUIDELINES:
- Be professional, empathetic, and efficient
- For emergencies (gas leaks, flooding, no heat in winter), expedite the process
- Always confirm the caller's callback number
- If the caller requests a human, immediately transfer the call
- Keep responses concise - this is a phone call, not a chat
- Spell out numbers clearly (e.g., "unit three-oh-four" not "unit 304")

AVAILABLE ACTIONS:
- Look up properties by name or address
- Look up units at a property
- Classify issues by trade (HVAC, plumbing, electrical, general)
- Create incidents/tickets
- Dispatch vendors via call or SMS
- Transfer calls to human agents when needed`;

const TOOLS_SCHEMA = [
  {
    type: "function",
    name: "lookupProperty",
    description: "Search for a property by name, address, or alias. Call this when the caller mentions a property.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Property name, address, or alias to search for" },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "lookupUnit",
    description: "Look up a specific unit at a property to verify it exists.",
    parameters: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "Property ID from lookupProperty result" },
        unitNumber: { type: "string", description: "Unit number (e.g., '304', 'A1')" },
      },
      required: ["propertyId", "unitNumber"],
    },
  },
  {
    type: "function",
    name: "classifyIssue",
    description: "Classify the reported issue by trade type and severity.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "Description of the issue from the caller" },
      },
      required: ["description"],
    },
  },
  {
    type: "function",
    name: "createIncident",
    description: "Create a maintenance ticket/incident for the reported issue.",
    parameters: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "Property ID" },
        unitId: { type: "string", description: "Unit ID if applicable" },
        trade: { type: "string", enum: ["hvac", "plumbing", "electrical", "general", "appliance", "locksmith"], description: "Trade type" },
        severity: { type: "string", enum: ["emergency", "urgent", "normal", "low"], description: "Issue severity" },
        summary: { type: "string", description: "Brief summary of the issue" },
        callerPhone: { type: "string", description: "Caller's phone number for callback" },
        callerName: { type: "string", description: "Caller's name if provided" },
      },
      required: ["propertyId", "trade", "severity", "summary"],
    },
  },
  {
    type: "function",
    name: "dispatchVendor",
    description: "Dispatch a vendor to handle the incident. Call this after creating an incident.",
    parameters: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID from createIncident result" },
        contactMethod: { type: "string", enum: ["call", "sms"], description: "How to contact the vendor" },
      },
      required: ["incidentId"],
    },
  },
  {
    type: "function",
    name: "transferToHuman",
    description: "Transfer the call to a human agent. Use when caller requests it or for complex situations.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why the call is being transferred" },
      },
      required: ["reason"],
    },
  },
];

interface RealtimeSession {
  openaiWs: WebSocket | null;
  twilioWs: WebSocket;
  callSession: CallSession;
  accountId: string;
  streamSid: string | null;
}

const activeSessions: Map<string, RealtimeSession> = new Map();

export async function handleTwilioMediaStream(twilioWs: WebSocket, callSessionId: string) {
  console.log(`[OpenAI Realtime] Starting session for call ${callSessionId}`);

  const callSession = await storage.getCallSession(callSessionId);
  if (!callSession) {
    console.error(`[OpenAI Realtime] Call session not found: ${callSessionId}`);
    twilioWs.close();
    return;
  }

  const session: RealtimeSession = {
    openaiWs: null,
    twilioWs,
    callSession,
    accountId: callSession.accountId || "demo-account",
    streamSid: null,
  };

  activeSessions.set(callSessionId, session);

  if (!OPENAI_API_KEY) {
    console.error("[OpenAI Realtime] OPENAI_API_KEY not configured");
    twilioWs.send(JSON.stringify({
      event: "media",
      streamSid: session.streamSid,
      media: { payload: Buffer.from("API key not configured").toString("base64") },
    }));
    twilioWs.close();
    return;
  }

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  session.openaiWs = openaiWs;

  openaiWs.on("open", () => {
    console.log("[OpenAI Realtime] Connected to OpenAI");
    
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: SYSTEM_PROMPT,
        voice: "alloy",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: TOOLS_SCHEMA,
        tool_choice: "auto",
      },
    }));

    openaiWs.send(JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Greet the caller warmly and ask how you can help them today.",
      },
    }));
  });

  openaiWs.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());
      await handleOpenAIEvent(session, event);
    } catch (error) {
      console.error("[OpenAI Realtime] Error parsing message:", error);
    }
  });

  openaiWs.on("error", (error) => {
    console.error("[OpenAI Realtime] WebSocket error:", error);
  });

  openaiWs.on("close", () => {
    console.log("[OpenAI Realtime] Connection closed");
    activeSessions.delete(callSessionId);
  });

  twilioWs.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleTwilioEvent(session, data);
    } catch (error) {
      console.error("[OpenAI Realtime] Error handling Twilio message:", error);
    }
  });

  twilioWs.on("close", () => {
    console.log("[OpenAI Realtime] Twilio connection closed");
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    activeSessions.delete(callSessionId);
  });
}

async function handleTwilioEvent(session: RealtimeSession, event: any) {
  switch (event.event) {
    case "start":
      session.streamSid = event.start.streamSid;
      console.log(`[OpenAI Realtime] Stream started: ${session.streamSid}`);
      break;

    case "media":
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: event.media.payload,
        }));
      }
      break;

    case "stop":
      console.log("[OpenAI Realtime] Stream stopped");
      break;
  }
}

async function handleOpenAIEvent(session: RealtimeSession, event: any) {
  switch (event.type) {
    case "response.audio.delta":
      if (session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
        session.twilioWs.send(JSON.stringify({
          event: "media",
          streamSid: session.streamSid,
          media: { payload: event.delta },
        }));
      }
      break;

    case "response.audio_transcript.done":
      console.log(`[OpenAI Realtime] AI said: ${event.transcript}`);
      break;

    case "conversation.item.input_audio_transcription.completed":
      console.log(`[OpenAI Realtime] User said: ${event.transcript}`);
      break;

    case "response.function_call_arguments.done":
      await handleFunctionCall(session, event.name, JSON.parse(event.arguments), event.call_id);
      break;

    case "error":
      console.error("[OpenAI Realtime] Error:", event.error);
      break;
  }
}

async function handleFunctionCall(
  session: RealtimeSession,
  functionName: string,
  args: any,
  callId: string
) {
  console.log(`[OpenAI Realtime] Function call: ${functionName}`, args);
  
  let result: any;

  try {
    switch (functionName) {
      case "lookupProperty":
        result = await rulesEngine.resolvePropertyAndUnit(args.query, session.accountId);
        break;

      case "lookupUnit":
        result = await storage.getUnitByNumber(args.propertyId, args.unitNumber);
        break;

      case "classifyIssue":
        result = rulesEngine.classifyTradeAndSeverity(args.description);
        break;

      case "createIncident":
        const incident = await storage.createIncident({
          accountId: session.accountId,
          propertyId: args.propertyId,
          unitId: args.unitId,
          trade: args.trade,
          severity: args.severity,
          summary: args.summary,
          callerPhone: args.callerPhone || session.callSession.callerNumber,
          status: "open",
          auditLog: [{
            timestamp: new Date().toISOString(),
            action: "Incident created by AI operator",
            details: `Trade: ${args.trade}, Severity: ${args.severity}`,
          }],
        });
        result = { incidentId: incident.id, message: "Incident created successfully" };
        break;

      case "dispatchVendor":
        const incidentForDispatch = await storage.getIncident(args.incidentId);
        if (incidentForDispatch) {
          const vendorSelection = await rulesEngine.selectVendor(
            incidentForDispatch.trade || "general",
            incidentForDispatch.propertyId || "",
            session.accountId,
            false
          );
          if (vendorSelection.vendor) {
            const dispatchResult = await dispatchService.dispatchVendor(
              args.incidentId,
              vendorSelection.vendor.id,
              args.contactMethod || "sms"
            );
            result = dispatchResult;
          } else {
            result = { error: vendorSelection.error || "No vendor available for this trade" };
          }
        } else {
          result = { error: "Incident not found" };
        }
        break;

      case "transferToHuman":
        const users = await storage.getUsers(session.accountId);
        const onCallUser = users.find(u => u.role === "on_call" && u.availability === "available");
        
        if (onCallUser && onCallUser.phoneNumber) {
          await telephonyAdapter.transferCall(session.callSession.id, onCallUser.phoneNumber);
          result = { transferred: true, to: "on-call agent" };
        } else {
          const availableAgent = users.find(u => u.availability === "available" && u.phoneNumber);
          if (availableAgent && availableAgent.phoneNumber) {
            await telephonyAdapter.transferCall(session.callSession.id, availableAgent.phoneNumber);
            result = { transferred: true, to: "available agent" };
          } else {
            result = { transferred: false, message: "No agents available, taking a message" };
          }
        }
        break;

      default:
        result = { error: `Unknown function: ${functionName}` };
    }
  } catch (error: any) {
    console.error(`[OpenAI Realtime] Function error:`, error);
    result = { error: error.message || "Function execution failed" };
  }

  if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
    session.openaiWs.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    }));

    session.openaiWs.send(JSON.stringify({
      type: "response.create",
    }));
  }
}

export function closeSession(callSessionId: string) {
  const session = activeSessions.get(callSessionId);
  if (session) {
    if (session.openaiWs) session.openaiWs.close();
    if (session.twilioWs) session.twilioWs.close();
    activeSessions.delete(callSessionId);
  }
}
