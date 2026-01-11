/**
 * VoIP Service for Staff App
 * 
 * Provides Twilio Client capability tokens for browser/mobile VoIP
 * Staff can receive calls in-app without using personal phone numbers
 */

import twilio from "twilio";
import { Request, Response } from "express";
import { storage } from "../storage";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

interface DeviceRegistration {
  userId: string;
  deviceId: string;
  platform: "web" | "ios" | "android";
  pushToken?: string;
  registeredAt: Date;
  lastSeen: Date;
}

const registeredDevices = new Map<string, DeviceRegistration>();
const userPresence = new Map<string, "online" | "away" | "offline">();

/**
 * Generate Twilio Client capability token for staff member
 */
export async function generateClientToken(req: Request, res: Response) {
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: "Twilio not configured" });
  }

  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = `user_${user.id}`;

    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.warn("[VoIP] TWILIO_API_KEY and TWILIO_API_SECRET not configured - using account credentials (not recommended for production)");
    }

    const token = new AccessToken(
      accountSid,
      apiKey || accountSid,
      apiSecret || authToken,
      { identity, ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    await storage.updateUser(user.id, {
      appEndpoint: `client:${identity}`,
    });

    console.log(`[VoIP] Generated token for ${identity}`);

    return res.json({
      token: token.toJwt(),
      identity,
      expiresIn: 3600,
    });

  } catch (error) {
    console.error("[VoIP] Failed to generate token:", error);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}

/**
 * Register device for push notifications
 */
export async function registerDevice(req: Request, res: Response) {
  const user = req.user as any;
  const { deviceId, platform, pushToken } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!deviceId || !platform) {
    return res.status(400).json({ error: "Missing deviceId or platform" });
  }

  const registration: DeviceRegistration = {
    userId: user.id,
    deviceId,
    platform,
    pushToken,
    registeredAt: new Date(),
    lastSeen: new Date(),
  };

  registeredDevices.set(`${user.id}:${deviceId}`, registration);

  console.log(`[VoIP] Device registered: ${user.id} on ${platform}`);

  return res.json({ success: true, deviceId });
}

/**
 * Update user presence/availability
 */
export async function updatePresence(req: Request, res: Response) {
  const user = req.user as any;
  const { status } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!["online", "away", "offline"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  userPresence.set(user.id, status);

  const availabilityMap: Record<string, string> = {
    online: "available",
    away: "busy",
    offline: "offline",
  };

  await storage.updateUser(user.id, {
    availability: availabilityMap[status],
  });

  console.log(`[VoIP] Presence updated: ${user.id} -> ${status}`);

  return res.json({ success: true, status });
}

/**
 * Get staff availability for a location
 */
export async function getLocationStaffStatus(req: Request, res: Response) {
  const user = req.user as any;
  const locationId = req.params.locationId;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const users = await storage.getUsers(user.accountId);
    const locationStaff = users
      .filter(u => u.locationId === locationId)
      .map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        availability: u.availability,
        presence: userPresence.get(u.id) || "offline",
        hasAppEndpoint: !!u.appEndpoint,
      }));

    return res.json({ staff: locationStaff });

  } catch (error) {
    console.error("[VoIP] Failed to get staff status:", error);
    return res.status(500).json({ error: "Failed to get staff status" });
  }
}

/**
 * Handle incoming call to Twilio Client
 */
export async function handleClientCall(req: Request, res: Response) {
  const to = req.body.To;
  const from = req.body.From;
  const callSessionId = req.query.callSessionId as string;

  console.log(`[VoIP] Client call: ${from} -> ${to}`);

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (to && to.startsWith("client:")) {
    const dial = response.dial({
      callerId: twilioPhoneNumber || from,
      timeout: 30,
    });
    dial.client({}, to.replace("client:", ""));
  } else if (to) {
    const dial = response.dial({
      callerId: twilioPhoneNumber || from,
      timeout: 30,
    });
    dial.number({}, to);
  } else {
    response.say({ voice: "alice" }, "No destination specified.");
    response.hangup();
  }

  res.type("text/xml");
  res.send(response.toString());
}

/**
 * Send push notification for incoming call
 */
export async function sendCallNotification(
  userId: string, 
  callerInfo: { number: string; name?: string; reason?: string }
): Promise<boolean> {
  const userDevices = Array.from(registeredDevices.entries())
    .filter(([key]) => key.startsWith(`${userId}:`))
    .map(([, reg]) => reg);

  if (userDevices.length === 0) {
    console.log(`[VoIP] No registered devices for user ${userId}`);
    return false;
  }

  for (const device of userDevices) {
    if (device.pushToken) {
      console.log(`[VoIP] Would send push to ${device.platform}: ${device.pushToken}`);
    }
  }

  return true;
}

/**
 * Get user's registered devices
 */
export async function getUserDevices(req: Request, res: Response) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const devices = Array.from(registeredDevices.entries())
    .filter(([key]) => key.startsWith(`${user.id}:`))
    .map(([, reg]) => ({
      deviceId: reg.deviceId,
      platform: reg.platform,
      registeredAt: reg.registeredAt,
      lastSeen: reg.lastSeen,
    }));

  return res.json({ devices });
}

/**
 * Heartbeat to keep device registered
 */
export async function deviceHeartbeat(req: Request, res: Response) {
  const user = req.user as any;
  const { deviceId } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const key = `${user.id}:${deviceId}`;
  const device = registeredDevices.get(key);

  if (device) {
    device.lastSeen = new Date();
    registeredDevices.set(key, device);
  }

  return res.json({ success: true });
}
