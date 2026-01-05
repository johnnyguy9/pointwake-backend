import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { UserRole } from "@shared/schema";
import { UserRoles } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      accountId: string;
      role: string;
      username: string;
      name: string;
      email?: string | null;
      fullName?: string | null;
      availability: string;
      phoneNumber?: string | null;
      locationId?: string | null;
    }
  }
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requirePermission(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function requireAccountAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const adminRoles = [UserRoles.SUPER_ADMIN, UserRoles.ACCOUNT_ADMIN];
  if (!adminRoles.includes(req.user.role as UserRole)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== UserRoles.SUPER_ADMIN) {
    return res.status(403).json({ error: "Super admin access required" });
  }

  next();
}

export function createOwnershipMiddleware(table: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role === UserRoles.SUPER_ADMIN) {
      return next();
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      return next();
    }

    try {
      const isOwner = await storage.verifyOwnership(table, resourceId, req.user.accountId);
      if (!isOwner) {
        return res.status(403).json({ error: "Access denied to this resource" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ error: "Failed to verify resource ownership" });
    }
  };
}

export function checkAccountStatus() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    if (req.user.role === UserRoles.SUPER_ADMIN) {
      return next();
    }

    try {
      const account = await storage.getAccount(req.user.accountId);
      if (account && account.status === "suspended") {
        return res.status(403).json({ error: "Account is suspended. Contact support." });
      }
      next();
    } catch (error) {
      next();
    }
  };
}
