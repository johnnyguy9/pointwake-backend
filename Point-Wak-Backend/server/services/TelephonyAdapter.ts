/**
 * PointWake Telephony Adapter
 * Twilio implementation for phone calls and SMS
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

export interface TelephonyAdapter {
  makeCall(to: string, webhookUrl: string): Promise<string | null>;
  sendSMS(to: string, message: string): Promise<string | null>;
  getCallStatus(callSid: string): Promise<string | null>;
  endCall(callSid: string): Promise<boolean>;
  transferCall(callSid: string, to: string): Promise<boolean>;
  ringGroup(callSid: string, endpoints: string[]): Promise<boolean>;
  getFromNumber(): string;
}

class TwilioTelephonyAdapter implements TelephonyAdapter {
  getFromNumber(): string {
    return twilioPhoneNumber || "";
  }

  async makeCall(to: string, webhookUrl: string): Promise<string | null> {
    try {
      const client = getClient();
      const call = await client.calls.create({
        to,
        from: twilioPhoneNumber!,
        url: webhookUrl,
        statusCallback: webhookUrl.replace(/\/voice$/, "/status"),
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
      });
      console.log(`[Twilio] Outbound call initiated: ${call.sid} to ${to}`);
      return call.sid;
    } catch (error) {
      console.error("[Twilio] Failed to make call:", error);
      return null;
    }
  }

  async sendSMS(to: string, message: string): Promise<string | null> {
    try {
      const client = getClient();
      const sms = await client.messages.create({
        to,
        from: twilioPhoneNumber!,
        body: message,
      });
      console.log(`[Twilio] SMS sent: ${sms.sid} to ${to}`);
      return sms.sid;
    } catch (error) {
      console.error("[Twilio] Failed to send SMS:", error);
      return null;
    }
  }

  async getCallStatus(callSid: string): Promise<string | null> {
    try {
      const client = getClient();
      const call = await client.calls(callSid).fetch();
      console.log(`[Twilio] Call ${callSid} status: ${call.status}`);
      return call.status;
    } catch (error) {
      console.error("[Twilio] Failed to get call status:", error);
      return null;
    }
  }

  async endCall(callSid: string): Promise<boolean> {
    try {
      const client = getClient();
      await client.calls(callSid).update({ status: "completed" });
      console.log(`[Twilio] Call ended: ${callSid}`);
      return true;
    } catch (error) {
      console.error("[Twilio] Failed to end call:", error);
      return false;
    }
  }

  async transferCall(callSid: string, to: string): Promise<boolean> {
    try {
      const client = getClient();
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: "alice" }, "Transferring your call now. Please hold.");
      twiml.dial({}, to);
      
      await client.calls(callSid).update({
        twiml: twiml.toString(),
      });
      console.log(`[Twilio] Call ${callSid} transferred to ${to}`);
      return true;
    } catch (error) {
      console.error("[Twilio] Failed to transfer call:", error);
      return false;
    }
  }

  async ringGroup(callSid: string, endpoints: string[]): Promise<boolean> {
    try {
      const client = getClient();
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: "alice" }, "Connecting you to an available agent.");
      
      const dial = twiml.dial({ timeout: 30 });
      for (const endpoint of endpoints) {
        dial.number({}, endpoint);
      }
      
      await client.calls(callSid).update({
        twiml: twiml.toString(),
      });
      console.log(`[Twilio] Call ${callSid} ring group: ${endpoints.join(", ")}`);
      return true;
    } catch (error) {
      console.error("[Twilio] Failed to ring group:", error);
      return false;
    }
  }
}

export const telephonyAdapter = new TwilioTelephonyAdapter();
export const VoiceResponse = twilio.twiml.VoiceResponse;
export const MessagingResponse = twilio.twiml.MessagingResponse;
