/**
 * Wake Analyzer Service
 * Handles communication with Python microservice and database persistence
 */

import { db } from "../db";
import { wakeAnalyzerDatasets, wakeAnalyzerAnalyses } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { User } from "../../shared/schema";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const PYTHON_SERVICE_URL = process.env.WAKE_ANALYZER_SERVICE_URL || "http://localhost:5000";
const UPLOAD_DIR = process.env.WAKE_ANALYZER_UPLOAD_DIR || "/tmp/wake-analyzer-uploads";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class WakeAnalyzerService {
  /**
   * Upload CSV file and create dataset record
   */
  static async uploadDataset(
    file: Express.Multer.File,
    user: User
  ): Promise<{
    success: boolean;
    sessionId?: string;
    metadata?: any;
    error?: string;
  }> {
    try {
      // Generate unique session ID
      const sessionId = this.generateSessionId();

      // Create form data for Python service
      const formData = new FormData();
      formData.append("file", fs.createReadStream(file.path));
      formData.append("session_id", sessionId);

      // Send to Python service
      const response = await fetch(`${PYTHON_SERVICE_URL}/upload`, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      });

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Upload failed",
        };
      }

      // Store dataset metadata in database
      const [dataset] = await db
        .insert(wakeAnalyzerDatasets)
        .values({
          accountId: user.accountId,
          userId: user.id,
          sessionId,
          filename: file.originalname,
          filePath: file.path,
          rowCount: result.metadata.row_count,
          columnCount: result.metadata.columns.length,
          columns: result.metadata.columns,
          columnTypes: result.metadata.column_types,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        })
        .returning();

      return {
        success: true,
        sessionId,
        metadata: result.metadata,
      };
    } catch (error: any) {
      console.error("Upload error:", error);
      return {
        success: false,
        error: error.message || "Upload failed",
      };
    }
  }

  /**
   * Validate execution plan
   */
  static async validatePlan(plan: any): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plan),
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message || "Validation failed"],
      };
    }
  }

  /**
   * Execute analytics plan
   */
  static async executePlan(
    sessionId: string,
    plan: any,
    user: User
  ): Promise<{
    success: boolean;
    result?: any;
    chart?: string;
    error?: string;
    requires_clarification?: boolean;
    clarification_question?: string;
  }> {
    const startTime = Date.now();

    try {
      // Verify dataset belongs to user
      const dataset = await db.query.wakeAnalyzerDatasets.findFirst({
        where: and(
          eq(wakeAnalyzerDatasets.sessionId, sessionId),
          eq(wakeAnalyzerDatasets.accountId, user.accountId)
        ),
      });

      if (!dataset) {
        return {
          success: false,
          error: "Dataset not found or access denied",
        };
      }

      // Execute via Python service
      const response = await fetch(`${PYTHON_SERVICE_URL}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          plan,
        }),
      });

      const result = await response.json();

      const executionTime = Date.now() - startTime;

      // Save execution record
      await db.insert(wakeAnalyzerAnalyses).values({
        accountId: user.accountId,
        userId: user.id,
        datasetId: dataset.id,
        sessionId,
        executionPlan: plan,
        result: result.success ? result.result : null,
        chartData: result.chart || null,
        filteredRowCount: result.filtered_row_count,
        executionTimeMs: executionTime,
        success: result.success,
        errorMessage: result.error || null,
      });

      return result;
    } catch (error: any) {
      console.error("Execution error:", error);

      // Log failed execution
      try {
        const dataset = await db.query.wakeAnalyzerDatasets.findFirst({
          where: eq(wakeAnalyzerDatasets.sessionId, sessionId),
        });

        if (dataset) {
          await db.insert(wakeAnalyzerAnalyses).values({
            accountId: user.accountId,
            userId: user.id,
            datasetId: dataset.id,
            sessionId,
            executionPlan: plan,
            result: null,
            success: false,
            errorMessage: error.message,
            executionTimeMs: Date.now() - startTime,
          });
        }
      } catch (dbError) {
        console.error("Failed to log error:", dbError);
      }

      return {
        success: false,
        error: error.message || "Execution failed",
      };
    }
  }

  /**
   * Get dataset metadata
   */
  static async getDataset(sessionId: string, user: User) {
    return await db.query.wakeAnalyzerDatasets.findFirst({
      where: and(
        eq(wakeAnalyzerDatasets.sessionId, sessionId),
        eq(wakeAnalyzerDatasets.accountId, user.accountId)
      ),
    });
  }

  /**
   * Get analysis history for a dataset
   */
  static async getAnalysisHistory(sessionId: string, user: User) {
    const dataset = await this.getDataset(sessionId, user);

    if (!dataset) {
      return [];
    }

    return await db.query.wakeAnalyzerAnalyses.findMany({
      where: and(
        eq(wakeAnalyzerAnalyses.datasetId, dataset.id),
        eq(wakeAnalyzerAnalyses.accountId, user.accountId)
      ),
      orderBy: [desc(wakeAnalyzerAnalyses.executedAt)],
      limit: 50,
    });
  }

  /**
   * Get user's datasets
   */
  static async getUserDatasets(user: User) {
    return await db.query.wakeAnalyzerDatasets.findMany({
      where: eq(wakeAnalyzerDatasets.accountId, user.accountId),
      orderBy: [desc(wakeAnalyzerDatasets.uploadedAt)],
      limit: 20,
    });
  }

  /**
   * Delete dataset and associated analyses
   */
  static async deleteDataset(sessionId: string, user: User): Promise<boolean> {
    try {
      const dataset = await this.getDataset(sessionId, user);

      if (!dataset) {
        return false;
      }

      // Delete file
      if (fs.existsSync(dataset.filePath)) {
        fs.unlinkSync(dataset.filePath);
      }

      // Delete from Python service
      try {
        await fetch(`${PYTHON_SERVICE_URL}/session/${sessionId}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.warn("Failed to delete from Python service:", e);
      }

      // Database cascade delete will handle analyses
      await db.delete(wakeAnalyzerDatasets).where(eq(wakeAnalyzerDatasets.id, dataset.id));

      return true;
    } catch (error) {
      console.error("Delete error:", error);
      return false;
    }
  }

  /**
   * Health check for Python service
   */
  static async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
        method: "GET",
        timeout: 5000,
      });

      const result = await response.json();

      return {
        healthy: result.status === "healthy",
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  private static generateSessionId(): string {
    return `wa_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
