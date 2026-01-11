/**
 * Twilio Client Hook
 * 
 * Handles WebRTC-based voice calls in the browser using Twilio Client SDK.
 * Staff can receive transferred calls without using personal phone numbers.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";

// Twilio Client types (loaded from CDN)
declare global {
  interface Window {
    Twilio: {
      Device: new (token: string, options?: any) => TwilioDevice;
    };
  }
}

interface TwilioDevice {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  state: string;
}

interface TwilioCall {
  accept: () => void;
  reject: () => void;
  disconnect: () => void;
  mute: (shouldMute: boolean) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  parameters: {
    From?: string;
    To?: string;
    CallSid?: string;
  };
  direction: "INCOMING" | "OUTGOING";
  status: () => string;
}

export interface CallState {
  isIncoming: boolean;
  isActive: boolean;
  isMuted: boolean;
  callerNumber: string | null;
  callSid: string | null;
  direction: "incoming" | "outgoing" | null;
  status: "idle" | "ringing" | "connecting" | "connected" | "disconnected";
  duration: number;
}

interface UseTwilioClientOptions {
  onIncomingCall?: (call: TwilioCall) => void;
  onCallAccepted?: (call: TwilioCall) => void;
  onCallDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export function useTwilioClient(options: UseTwilioClientOptions = {}) {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isActive: false,
    isMuted: false,
    callerNumber: null,
    callSid: null,
    direction: null,
    status: "idle",
    duration: 0,
  });
  
  const deviceRef = useRef<TwilioDevice | null>(null);
  const currentCallRef = useRef<TwilioCall | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timer | null>(null);
  const tokenRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load Twilio Client SDK from CDN
   */
  const loadTwilioSdk = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.Twilio?.Device) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.twilio.com/js/client/v1.14/twilio.min.js";
      script.async = true;
      
      script.onload = () => {
        if (window.Twilio?.Device) {
          resolve();
        } else {
          reject(new Error("Twilio SDK failed to load"));
        }
      };
      
      script.onerror = () => reject(new Error("Failed to load Twilio SDK"));
      
      document.body.appendChild(script);
    });
  }, []);

  /**
   * Get access token from backend
   */
  const getAccessToken = useCallback(async (): Promise<string> => {
    const response = await apiRequest("/api/voip/token", {
      method: "POST",
    });
    
    if (!response.token) {
      throw new Error("No token received from server");
    }
    
    return response.token;
  }, []);

  /**
   * Initialize Twilio Device
   */
  const initializeDevice = useCallback(async (token: string) => {
    if (!window.Twilio?.Device) {
      throw new Error("Twilio SDK not loaded");
    }

    // Clean up existing device
    if (deviceRef.current) {
      deviceRef.current.destroy();
    }

    const device = new window.Twilio.Device(token, {
      codecPreferences: ["opus", "pcmu"],
      fakeLocalDTMF: true,
      enableRingingState: true,
    });

    // Device events
    device.on("registered", () => {
      console.log("[TwilioClient] Device registered");
      setIsRegistered(true);
      setIsRegistering(false);
      setError(null);
    });

    device.on("unregistered", () => {
      console.log("[TwilioClient] Device unregistered");
      setIsRegistered(false);
    });

    device.on("error", (err: any) => {
      console.error("[TwilioClient] Device error:", err);
      setError(err.message || "Device error");
      setIsRegistering(false);
      options.onError?.(err);
    });

    device.on("incoming", (call: TwilioCall) => {
      console.log("[TwilioClient] Incoming call:", call.parameters);
      currentCallRef.current = call;
      
      setCallState({
        isIncoming: true,
        isActive: false,
        isMuted: false,
        callerNumber: call.parameters.From || "Unknown",
        callSid: call.parameters.CallSid || null,
        direction: "incoming",
        status: "ringing",
        duration: 0,
      });

      setupCallHandlers(call);
      options.onIncomingCall?.(call);
    });

    device.on("tokenWillExpire", async () => {
      console.log("[TwilioClient] Token expiring, refreshing...");
      try {
        const newToken = await getAccessToken();
        // Note: Twilio Device v1.x doesn't have updateToken, need to reinitialize
        await initializeDevice(newToken);
      } catch (err) {
        console.error("[TwilioClient] Failed to refresh token:", err);
      }
    });

    deviceRef.current = device;
    await device.register();

    // Schedule token refresh (45 minutes before 1 hour expiry)
    if (tokenRefreshTimeoutRef.current) {
      clearTimeout(tokenRefreshTimeoutRef.current);
    }
    tokenRefreshTimeoutRef.current = setTimeout(async () => {
      try {
        const newToken = await getAccessToken();
        await initializeDevice(newToken);
      } catch (err) {
        console.error("[TwilioClient] Token refresh failed:", err);
      }
    }, 45 * 60 * 1000);

  }, [getAccessToken, options]);

  /**
   * Setup call event handlers
   */
  const setupCallHandlers = useCallback((call: TwilioCall) => {
    call.on("accept", () => {
      console.log("[TwilioClient] Call accepted");
      setCallState(prev => ({
        ...prev,
        isActive: true,
        status: "connected",
      }));

      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTime) / 1000),
        }));
      }, 1000);

      options.onCallAccepted?.(call);
    });

    call.on("disconnect", () => {
      console.log("[TwilioClient] Call disconnected");
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      setCallState({
        isIncoming: false,
        isActive: false,
        isMuted: false,
        callerNumber: null,
        callSid: null,
        direction: null,
        status: "disconnected",
        duration: 0,
      });

      currentCallRef.current = null;
      options.onCallDisconnected?.();

      // Reset status after brief delay
      setTimeout(() => {
        setCallState(prev => ({ ...prev, status: "idle" }));
      }, 2000);
    });

    call.on("cancel", () => {
      console.log("[TwilioClient] Call cancelled");
      setCallState(prev => ({
        ...prev,
        isIncoming: false,
        status: "idle",
      }));
      currentCallRef.current = null;
    });

    call.on("reject", () => {
      console.log("[TwilioClient] Call rejected");
      setCallState(prev => ({
        ...prev,
        isIncoming: false,
        status: "idle",
      }));
      currentCallRef.current = null;
    });
  }, [options]);

  /**
   * Register device with Twilio
   */
  const register = useCallback(async () => {
    if (isRegistered || isRegistering) return;

    setIsRegistering(true);
    setError(null);

    try {
      await loadTwilioSdk();
      const token = await getAccessToken();
      await initializeDevice(token);
    } catch (err: any) {
      console.error("[TwilioClient] Registration failed:", err);
      setError(err.message || "Failed to register");
      setIsRegistering(false);
    }
  }, [isRegistered, isRegistering, loadTwilioSdk, getAccessToken, initializeDevice]);

  /**
   * Unregister device
   */
  const unregister = useCallback(async () => {
    if (deviceRef.current) {
      await deviceRef.current.unregister();
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    
    if (tokenRefreshTimeoutRef.current) {
      clearTimeout(tokenRefreshTimeoutRef.current);
    }
    
    setIsRegistered(false);
  }, []);

  /**
   * Answer incoming call
   */
  const answerCall = useCallback(() => {
    if (currentCallRef.current && callState.isIncoming) {
      currentCallRef.current.accept();
    }
  }, [callState.isIncoming]);

  /**
   * Reject incoming call
   */
  const rejectCall = useCallback(() => {
    if (currentCallRef.current && callState.isIncoming) {
      currentCallRef.current.reject();
    }
  }, [callState.isIncoming]);

  /**
   * Hang up current call
   */
  const hangUp = useCallback(() => {
    if (currentCallRef.current) {
      currentCallRef.current.disconnect();
    }
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (currentCallRef.current && callState.isActive) {
      const newMuteState = !callState.isMuted;
      currentCallRef.current.mute(newMuteState);
      setCallState(prev => ({ ...prev, isMuted: newMuteState }));
    }
  }, [callState.isActive, callState.isMuted]);

  // Auto-register when user is authenticated
  useEffect(() => {
    if (user && !isRegistered && !isRegistering) {
      register();
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [user, isRegistered, isRegistering, register]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
      if (tokenRefreshTimeoutRef.current) {
        clearTimeout(tokenRefreshTimeoutRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    isRegistered,
    isRegistering,
    error,
    callState,
    register,
    unregister,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
  };
}

/**
 * Format duration as MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
