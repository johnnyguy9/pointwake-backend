/**
 * Staff On-Duty Management Service
 * 
 * Manages staff assignments to locations and on-duty schedules
 */

import { Request, Response } from "express";
import { storage } from "../storage";

interface OnDutySchedule {
  userId: string;
  locationId: string;
  startTime: Date;
  endTime: Date | null;
}

const activeShifts = new Map<string, OnDutySchedule>();

/**
 * Start on-duty shift for a staff member at a location
 */
export async function startShift(req: Request, res: Response) {
  const user = req.user as any;
  const { locationId } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!locationId) {
    return res.status(400).json({ error: "Missing locationId" });
  }

  const locations = await storage.getLocations(user.accountId);
  const location = locations.find(l => l.id === locationId);
  
  if (!location) {
    return res.status(404).json({ error: "Location not found" });
  }

  await storage.updateUser(user.id, {
    locationId,
    availability: "available",
  });

  const shift: OnDutySchedule = {
    userId: user.id,
    locationId,
    startTime: new Date(),
    endTime: null,
  };

  activeShifts.set(user.id, shift);

  console.log(`[Staff] ${user.name} started shift at ${location.name}`);

  return res.json({ 
    success: true, 
    shift: {
      locationId,
      locationName: location.name,
      startTime: shift.startTime,
    }
  });
}

/**
 * End on-duty shift
 */
export async function endShift(req: Request, res: Response) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const shift = activeShifts.get(user.id);
  
  if (shift) {
    shift.endTime = new Date();
    const durationMs = shift.endTime.getTime() - shift.startTime.getTime();
    const durationHours = durationMs / 3600000;
    
    console.log(`[Staff] ${user.name} ended shift (${durationHours.toFixed(2)} hours)`);
    activeShifts.delete(user.id);
  }

  await storage.updateUser(user.id, {
    availability: "offline",
  });

  return res.json({ 
    success: true, 
    shiftDuration: shift ? 
      (new Date().getTime() - shift.startTime.getTime()) / 3600000 : 0
  });
}

/**
 * Get current shift info
 */
export async function getCurrentShift(req: Request, res: Response) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const shift = activeShifts.get(user.id);
  
  if (!shift) {
    return res.json({ onDuty: false });
  }

  const locations = await storage.getLocations(user.accountId);
  const location = locations.find(l => l.id === shift.locationId);

  return res.json({
    onDuty: true,
    locationId: shift.locationId,
    locationName: location?.name,
    startTime: shift.startTime,
    durationMinutes: (new Date().getTime() - shift.startTime.getTime()) / 60000,
  });
}

/**
 * Get all on-duty staff across locations
 */
export async function getOnDutyStaff(req: Request, res: Response) {
  const user = req.user as any;
  const locationId = req.query.locationId as string | undefined;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const users = await storage.getUsers(user.accountId);
    const locations = await storage.getLocations(user.accountId);

    let onDutyUsers = users.filter(u => u.availability === "available");

    if (locationId) {
      onDutyUsers = onDutyUsers.filter(u => u.locationId === locationId);
    }

    const staffWithDetails = onDutyUsers.map(u => {
      const shift = activeShifts.get(u.id);
      const location = locations.find(l => l.id === u.locationId);
      
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        locationId: u.locationId,
        locationName: location?.name,
        availability: u.availability,
        hasAppEndpoint: !!u.appEndpoint,
        shiftStart: shift?.startTime,
        shiftDurationMinutes: shift ? 
          (new Date().getTime() - shift.startTime.getTime()) / 60000 : null,
      };
    });

    return res.json({ staff: staffWithDetails });

  } catch (error) {
    console.error("[Staff] Failed to get on-duty staff:", error);
    return res.status(500).json({ error: "Failed to get staff" });
  }
}

/**
 * Update staff location assignment
 */
export async function updateStaffLocation(req: Request, res: Response) {
  const user = req.user as any;
  const { userId, locationId } = req.body;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!["account_admin", "manager", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  try {
    await storage.updateUser(userId, { locationId });
    
    return res.json({ success: true });

  } catch (error) {
    console.error("[Staff] Failed to update staff location:", error);
    return res.status(500).json({ error: "Failed to update location" });
  }
}

/**
 * Get location summary with staff counts
 */
export async function getLocationsSummary(req: Request, res: Response) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const locations = await storage.getLocations(user.accountId);
    const users = await storage.getUsers(user.accountId);

    const summary = locations.map(location => {
      const locationStaff = users.filter(u => u.locationId === location.id);
      const onDutyCount = locationStaff.filter(u => u.availability === "available").length;
      
      return {
        id: location.id,
        name: location.name,
        totalStaff: locationStaff.length,
        onDutyCount,
        routingStrategy: location.routingStrategy,
        businessHours: {
          start: location.businessHoursStart,
          end: location.businessHoursEnd,
        },
        afterHoursPolicy: location.afterHoursPolicy,
      };
    });

    return res.json({ locations: summary });

  } catch (error) {
    console.error("[Staff] Failed to get locations summary:", error);
    return res.status(500).json({ error: "Failed to get summary" });
  }
}
