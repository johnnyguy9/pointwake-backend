/**
 * Twilio Webhook Handlers
 * Handles incoming calls, IVR menu, SMS responses, and AI voice integration
 */

import { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { VoiceResponse, MessagingResponse } from "./TelephonyAdapter";
import { storage } from "../storage";

const DEMO_ACCOUNT_ID = "acc-demo-001";
const USE_AI_VOICE = process.env.OPENAI_API_KEY && process.env.USE_AI_VOICE === "true";
const authToken = process.env.TWILIO_AUTH_TOKEN;

export async function handleAIVoiceCall(req: Request, res: Response) {
  const callSid = req.body.CallSid;
  const callerPhone = req.body.From;
  const calledNumber = req.body.To;

  console.log(`[Twilio AI] Incoming call: ${callSid} from ${callerPhone}`);

  let callSession;
  try {
    callSession = await storage.createCallSession({
      accountId: DEMO_ACCOUNT_ID,
      callerNumber: callerPhone,
      aiAnswered: true,
      state: "INBOUND_RECEIVED",
    });
  } catch (error) {
    console.error("[Twilio AI] Failed to create call session:", error);
    const response = new VoiceResponse();
    response.say({ voice: "alice" }, "We're experiencing technical difficulties. Please try again later.");
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }

  const response = new VoiceResponse();
  
  const host = req.get("host") || "localhost:5000";
  const protocol = req.secure ? "wss" : "ws";
  const streamUrl = `${protocol}://${host}/media-stream/${callSession.id}`;

  response.say({ voice: "alice" }, "Connecting you to our AI assistant. One moment please.");

  const connect = response.connect();
  connect.stream({
    url: streamUrl,
    track: "both_tracks",
  });

  res.type("text/xml");
  res.send(response.toString());
}

export function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "development" && !process.env.VALIDATE_TWILIO_SIGNATURE) {
    return next();
  }

  const twilioSignature = req.headers["x-twilio-signature"] as string;
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  
  if (!authToken) {
    console.error("[Twilio] Auth token not configured for signature validation");
    return res.status(500).send("Server configuration error");
  }

  const isValid = twilio.validateRequest(authToken, twilioSignature || "", url, req.body);
  
  if (!isValid) {
    console.warn("[Twilio] Invalid signature rejected:", req.originalUrl);
    return res.status(403).send("Forbidden");
  }
  
  next();
}

interface CallSessionState {
  propertyId?: string;
  unitNumber?: string;
  trade?: string;
  severity?: string;
  callerPhone?: string;
  step: "greeting" | "property" | "unit" | "trade" | "severity" | "confirm" | "complete";
}

const callStates = new Map<string, CallSessionState>();

export async function handleIncomingCall(req: Request, res: Response) {
  const callSid = req.body.CallSid;
  const callerPhone = req.body.From;
  const calledNumber = req.body.To;

  console.log(`[Twilio] Incoming call: ${callSid} from ${callerPhone} to ${calledNumber}`);

  if (!callStates.has(callSid)) {
    callStates.set(callSid, {
      callerPhone,
      step: "greeting",
    });

    try {
      await storage.createCallSession({
        accountId: DEMO_ACCOUNT_ID,
        callerNumber: callerPhone,
        aiAnswered: true,
        state: "INBOUND_RECEIVED",
      });
    } catch (error) {
      console.error("[Twilio] Failed to create call session:", error);
    }
  }

  const response = new VoiceResponse();
  
  response.say({ voice: "alice" }, 
    "Thank you for calling Point Wake property services. We're here to help with your maintenance request."
  );

  const gather = response.gather({
    action: "/api/twilio/gather?step=property",
    method: "POST",
    numDigits: 1,
    timeout: 10,
  });

  gather.say({ voice: "alice" },
    "Press 1 for River Oaks Apartments. Press 2 for Sunset Plaza. Press 0 to speak with an agent."
  );

  response.say({ voice: "alice" }, "We didn't receive your selection. Goodbye.");
  response.hangup();

  res.type("text/xml");
  res.send(response.toString());
}

export async function handleGather(req: Request, res: Response) {
  const callSid = req.body.CallSid;
  const digits = req.body.Digits;
  const step = req.query.step as string;

  console.log(`[Twilio] Gather on ${callSid}: step=${step}, digits=${digits}`);

  const state = callStates.get(callSid) || { step: "greeting" };
  const response = new VoiceResponse();

  if (step === "property") {
    if (digits === "1") {
      state.propertyId = "prop-river-001";
      state.step = "unit";

      const gather = response.gather({
        action: "/api/twilio/gather?step=unit",
        method: "POST",
        numDigits: 3,
        timeout: 10,
      });
      gather.say({ voice: "alice" },
        "River Oaks Apartments selected. Please enter your 3-digit unit number."
      );
      response.say({ voice: "alice" }, "We didn't receive your unit number. Please try again.");
      response.redirect("/api/twilio/voice");

    } else if (digits === "2") {
      state.propertyId = "prop-sunset-001";
      state.step = "trade";

      const gather = response.gather({
        action: "/api/twilio/gather?step=trade",
        method: "POST",
        numDigits: 1,
        timeout: 10,
      });
      gather.say({ voice: "alice" },
        "Sunset Plaza selected. What type of issue do you have? Press 1 for H V A C or heating and cooling. Press 2 for plumbing. Press 3 for electrical. Press 4 for other."
      );

    } else if (digits === "0") {
      response.say({ voice: "alice" }, "Transferring you to an agent. Please hold.");
      response.dial("+15551234567");
    } else {
      response.say({ voice: "alice" }, "Invalid selection. Please try again.");
      response.redirect("/api/twilio/voice");
    }

  } else if (step === "unit") {
    state.unitNumber = digits;
    state.step = "trade";

    const gather = response.gather({
      action: "/api/twilio/gather?step=trade",
      method: "POST",
      numDigits: 1,
      timeout: 10,
    });
    gather.say({ voice: "alice" },
      `Unit ${digits} confirmed. What type of issue do you have? Press 1 for H V A C or heating and cooling. Press 2 for plumbing. Press 3 for electrical. Press 4 for other.`
    );

  } else if (step === "trade") {
    const trades: Record<string, string> = {
      "1": "hvac",
      "2": "plumbing",
      "3": "electrical",
      "4": "general",
    };
    state.trade = trades[digits] || "general";
    state.step = "severity";

    const gather = response.gather({
      action: "/api/twilio/gather?step=severity",
      method: "POST",
      numDigits: 1,
      timeout: 10,
    });
    gather.say({ voice: "alice" },
      "Is this an emergency? Press 1 for emergency, such as flooding, fire, or gas leak. Press 2 for urgent, same day needed. Press 3 for normal, can wait a day or two."
    );

  } else if (step === "severity") {
    const severities: Record<string, string> = {
      "1": "emergency",
      "2": "urgent",
      "3": "normal",
    };
    state.severity = severities[digits] || "normal";
    state.step = "confirm";

    const tradeDisplay = state.trade === "hvac" ? "H V A C" : state.trade;
    const propertyName = state.propertyId === "prop-river-001" ? "River Oaks Apartments" : "Sunset Plaza";
    const unitInfo = state.unitNumber ? `, unit ${state.unitNumber}` : "";

    const gather = response.gather({
      action: "/api/twilio/gather?step=confirm",
      method: "POST",
      numDigits: 1,
      timeout: 10,
    });
    gather.say({ voice: "alice" },
      `To confirm: ${propertyName}${unitInfo}. ${tradeDisplay} issue. Severity: ${state.severity}. Press 1 to confirm and dispatch a technician. Press 2 to start over.`
    );

  } else if (step === "confirm") {
    if (digits === "1") {
      state.step = "complete";
      
      try {
        const incident = await storage.createIncident({
          accountId: DEMO_ACCOUNT_ID,
          propertyId: state.propertyId || null,
          unitId: state.unitNumber ? `unit-river-${state.unitNumber}` : null,
          trade: state.trade || "general",
          severity: state.severity || "normal",
          callerPhone: state.callerPhone || null,
          summary: `${state.trade?.toUpperCase() || "General"} issue - ${state.severity} priority`,
          description: `Created via IVR call from ${state.callerPhone}`,
          status: "open",
        });

        console.log(`[Twilio] Incident created: ${incident.id}`);

        response.say({ voice: "alice" },
          `Your request has been submitted. A ${state.trade} technician will be dispatched shortly. Your incident number is ${incident.id.slice(-4)}. You will receive a text message confirmation. Thank you for calling Point Wake. Goodbye.`
        );
      } catch (error) {
        console.error("[Twilio] Failed to create incident:", error);
        response.say({ voice: "alice" },
          "We encountered an error processing your request. Please try again or call back later. Goodbye."
        );
      }

      response.hangup();
      callStates.delete(callSid);

    } else {
      response.say({ voice: "alice" }, "Let's start over.");
      response.redirect("/api/twilio/voice");
    }
  }

  callStates.set(callSid, state);
  res.type("text/xml");
  res.send(response.toString());
}

export async function handleCallStatus(req: Request, res: Response) {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;

  console.log(`[Twilio] Call status: ${callSid} - ${callStatus} (duration: ${callDuration}s)`);

  if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer") {
    callStates.delete(callSid);
  }

  res.status(200).send("OK");
}

export async function handleIncomingSMS(req: Request, res: Response) {
  const from = req.body.From;
  const body = req.body.Body;
  const messageSid = req.body.MessageSid;

  console.log(`[Twilio] Incoming SMS: ${messageSid} from ${from}: "${body}"`);

  const response = new MessagingResponse();
  
  const lowerBody = body.toLowerCase().trim();
  
  if (lowerBody === "yes" || lowerBody === "confirm" || lowerBody === "accept") {
    response.message("Thank you for confirming. A technician will be in touch shortly.");
    console.log(`[Twilio] Vendor ${from} confirmed dispatch`);
  } else if (lowerBody === "no" || lowerBody === "decline" || lowerBody === "reject") {
    response.message("Dispatch declined. The request will be escalated to another vendor.");
    console.log(`[Twilio] Vendor ${from} declined dispatch`);
  } else {
    response.message("Thank you for your message. Reply YES to confirm or NO to decline a dispatch request.");
  }

  res.type("text/xml");
  res.send(response.toString());
}

export async function handleOutboundDispatch(req: Request, res: Response) {
  const incidentId = req.query.incidentId as string;
  const vendorName = req.query.vendorName as string;
  
  const response = new VoiceResponse();
  
  response.say({ voice: "alice" },
    `Hello, this is Point Wake property services with an urgent dispatch request for ${vendorName || "your company"}.`
  );

  if (incidentId) {
    const incident = await storage.getIncident(incidentId);
    if (incident) {
      const tradeDisplay = incident.trade === "hvac" ? "H V A C" : incident.trade;
      response.say({ voice: "alice" },
        `We have a ${incident.severity} priority ${tradeDisplay} issue. ${incident.summary || ""}`
      );
    }
  }

  const gather = response.gather({
    action: `/api/twilio/dispatch-response?incidentId=${incidentId}`,
    method: "POST",
    numDigits: 1,
    timeout: 15,
  });

  gather.say({ voice: "alice" },
    "Press 1 to accept this dispatch. Press 2 to decline. Press 9 to hear this message again."
  );

  response.say({ voice: "alice" }, "We did not receive a response. Goodbye.");
  response.hangup();

  res.type("text/xml");
  res.send(response.toString());
}

export async function handleDispatchResponse(req: Request, res: Response) {
  const digits = req.body.Digits;
  const incidentId = req.query.incidentId as string;
  const from = req.body.From;

  const response = new VoiceResponse();

  if (digits === "1") {
    response.say({ voice: "alice" },
      "Thank you for accepting this dispatch. Please proceed to the location as soon as possible. Goodbye."
    );
    console.log(`[Twilio] Vendor ${from} accepted dispatch for ${incidentId}`);
    
    if (incidentId) {
      const incident = await storage.getIncident(incidentId);
      if (incident) {
        const auditLog = (incident.auditLog as any[]) || [];
        auditLog.push({
          timestamp: new Date().toISOString(),
          action: "Vendor accepted via phone",
          details: `${from} accepted dispatch`,
        });
        await storage.updateIncident(incidentId, { status: "in_progress", auditLog });
      }
    }
  } else if (digits === "2") {
    response.say({ voice: "alice" },
      "You have declined this dispatch. We will contact another provider. Goodbye."
    );
    console.log(`[Twilio] Vendor ${from} declined dispatch for ${incidentId}`);
  } else if (digits === "9") {
    response.redirect(`/api/twilio/outbound-dispatch?incidentId=${incidentId}`);
    res.type("text/xml");
    return res.send(response.toString());
  } else {
    response.say({ voice: "alice" }, "Invalid selection. Goodbye.");
  }

  response.hangup();
  res.type("text/xml");
  res.send(response.toString());
}
