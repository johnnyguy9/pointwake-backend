import { storage } from "../storage";
import { rulesEngine } from "./RulesEngine";
import { dispatchService } from "./DispatchService";
import { billingService } from "./BillingService";
import { telephonyAdapter } from "./TelephonyAdapter";
import { CallStates, type CallState } from "@shared/schema";

/**
 * PointWake AI Voice Operator
 * Handles AI-powered call processing with tool-calling architecture.
 * 
 * TODO: Integrate with actual AI provider (OpenAI, Anthropic, etc.)
 * This is a framework with stub AI calls - implement with real LLM.
 */

export interface OperatorContext {
  callId: string;
  accountId: string;
  callerNumber: string;
  currentState: CallState;
  collectedData: {
    propertyQuery?: string;
    propertyId?: string;
    unitNumber?: string;
    unitId?: string;
    trade?: string;
    severity?: string;
    issueDescription?: string;
    callerName?: string;
  };
  transcript: string[];
}

export interface OperatorTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

// AI Operator Tools - these are the functions the AI can call
const OPERATOR_TOOLS: OperatorTool[] = [
  {
    name: "lookupProperty",
    description: "Search for a property by name, address, or alias",
    parameters: {
      query: { type: "string", description: "Property name, address, or alias to search for", required: true },
    },
  },
  {
    name: "lookupUnit",
    description: "Look up a specific unit at a property",
    parameters: {
      propertyId: { type: "string", description: "Property ID", required: true },
      unitNumber: { type: "string", description: "Unit number (e.g., '304')", required: true },
    },
  },
  {
    name: "classifyTradeAndSeverity",
    description: "Determine the trade (HVAC, plumbing, etc.) and severity based on caller description",
    parameters: {
      callerText: { type: "string", description: "The caller's description of the issue", required: true },
    },
  },
  {
    name: "getEscalationPolicy",
    description: "Get the escalation policy for a property",
    parameters: {
      propertyId: { type: "string", description: "Property ID", required: true },
    },
  },
  {
    name: "choosePreferredVendor",
    description: "Select the best vendor for a trade at a property",
    parameters: {
      trade: { type: "string", description: "Trade type (hvac, plumbing, etc.)", required: true },
      propertyId: { type: "string", description: "Property ID", required: true },
      afterHours: { type: "boolean", description: "Whether it's after business hours" },
    },
  },
  {
    name: "dispatchVendor",
    description: "Dispatch a vendor for an incident",
    parameters: {
      vendorId: { type: "string", description: "Vendor ID", required: true },
      incidentId: { type: "string", description: "Incident ID", required: true },
      contactMethod: { type: "string", description: "Contact method (call, sms, email)" },
    },
  },
  {
    name: "createOrUpdateIncident",
    description: "Create or update an incident/ticket",
    parameters: {
      data: { type: "object", description: "Incident data", required: true },
    },
  },
  {
    name: "transferCall",
    description: "Transfer call to a human agent or ring group",
    parameters: {
      toRingGroup: { type: "string", description: "Ring group or destination to transfer to" },
    },
  },
  {
    name: "sendSms",
    description: "Send an SMS message",
    parameters: {
      to: { type: "string", description: "Phone number to send to", required: true },
      message: { type: "string", description: "Message content", required: true },
    },
  },
  {
    name: "logAction",
    description: "Log an action to the incident audit trail",
    parameters: {
      incidentId: { type: "string", description: "Incident ID", required: true },
      action: { type: "string", description: "Action description", required: true },
    },
  },
];

export class PointWakeAIOperator {
  /**
   * Execute a tool call from the AI.
   */
  async executeTool(toolName: string, params: Record<string, any>, context: OperatorContext): Promise<any> {
    switch (toolName) {
      case "lookupProperty":
        return await rulesEngine.resolvePropertyAndUnit(params.query, context.accountId);

      case "lookupUnit":
        return await storage.getUnitByNumber(params.propertyId, params.unitNumber);

      case "classifyTradeAndSeverity":
        return rulesEngine.classifyTradeAndSeverity(params.callerText);

      case "getEscalationPolicy":
        return await rulesEngine.getEscalationDecision(params.propertyId, context.collectedData.severity || "normal");

      case "choosePreferredVendor":
        return await rulesEngine.selectVendor(
          params.trade,
          params.propertyId,
          context.accountId,
          params.afterHours || false
        );

      case "dispatchVendor":
        return await dispatchService.dispatchVendor(
          params.incidentId,
          params.vendorId,
          params.contactMethod || "sms"
        );

      case "createOrUpdateIncident":
        if (params.data.id) {
          return await storage.updateIncident(params.data.id, params.data);
        } else {
          return await storage.createIncident({
            accountId: context.accountId,
            ...params.data,
          });
        }

      case "transferCall":
        // Get users to ring
        const users = await storage.getUsers(context.accountId);
        const availableUsers = users.filter(u => u.availability === "available");
        const endpoints = availableUsers
          .map(u => u.appEndpoint || u.phoneNumber)
          .filter(Boolean) as string[];
        
        if (endpoints.length > 0) {
          await telephonyAdapter.ringGroup(context.callId, endpoints);
          return { transferred: true, endpoints };
        }
        return { transferred: false, error: "No available agents" };

      case "sendSms":
        return await telephonyAdapter.sendSMS(params.to, params.message);

      case "logAction":
        const incident = await storage.getIncident(params.incidentId);
        if (incident) {
          const auditLog = (incident.auditLog as any[] || []);
          auditLog.push({
            timestamp: new Date().toISOString(),
            action: params.action,
          });
          await storage.updateIncident(params.incidentId, { auditLog });
          return { logged: true };
        }
        return { logged: false, error: "Incident not found" };

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Generate AI response based on context.
   * TODO: Replace with actual LLM call (OpenAI, Anthropic, etc.)
   */
  async generateResponse(context: OperatorContext): Promise<{
    speech: string;
    toolCalls?: { name: string; params: Record<string, any> }[];
    nextState?: CallState;
  }> {
    // This is a STUB - replace with actual AI/LLM integration
    // The real implementation would:
    // 1. Build a prompt with context and available tools
    // 2. Call the LLM API
    // 3. Parse tool calls from the response
    // 4. Execute tools and get results
    // 5. Continue conversation

    const state = context.currentState;

    // Simple state-based responses for demonstration
    switch (state) {
      case CallStates.AI_GREETING:
        return {
          speech: "Thank you for calling PointWake property services. My name is Alex, your AI assistant. How can I help you today?",
          nextState: CallStates.AI_INTENT_DETECTION,
        };

      case CallStates.AI_INTENT_DETECTION:
        // Would analyze caller speech to determine intent
        return {
          speech: "I understand you're reporting an issue. Can you tell me which property and unit this is for?",
          nextState: CallStates.AI_PROPERTY_UNIT_RESOLUTION,
        };

      case CallStates.AI_PROPERTY_UNIT_RESOLUTION:
        // Would use lookupProperty and lookupUnit tools
        if (context.collectedData.propertyQuery) {
          return {
            speech: `I found the property. Can you describe what's happening?`,
            toolCalls: [
              { name: "lookupProperty", params: { query: context.collectedData.propertyQuery } },
            ],
            nextState: CallStates.AI_INFORMATION_COLLECTION,
          };
        }
        return {
          speech: "I didn't catch the property name. Could you repeat that?",
        };

      case CallStates.AI_INFORMATION_COLLECTION:
        // Would classify the issue
        return {
          speech: "Thank you for that information. Let me connect you with the right service provider.",
          toolCalls: [
            { name: "classifyTradeAndSeverity", params: { callerText: context.collectedData.issueDescription || "" } },
          ],
          nextState: CallStates.AI_ACTION_EXECUTION,
        };

      case CallStates.AI_ACTION_EXECUTION:
        // Would dispatch vendor
        return {
          speech: "I've dispatched a technician who should contact you shortly. Is there anything else I can help with?",
          nextState: CallStates.ENDED,
        };

      default:
        return {
          speech: "I'm here to help. What can I assist you with?",
        };
    }
  }

  /**
   * Determine if call should be transferred to human.
   */
  shouldTransferToHuman(context: OperatorContext, confidence: number = 0.7): boolean {
    // Transfer if:
    // 1. Confidence is low
    // 2. Emergency requires approval
    // 3. Caller explicitly requests human

    const lastTranscript = context.transcript[context.transcript.length - 1]?.toLowerCase() || "";
    
    if (lastTranscript.includes("speak to a person") || 
        lastTranscript.includes("talk to someone") ||
        lastTranscript.includes("human") ||
        lastTranscript.includes("representative") ||
        lastTranscript.includes("agent")) {
      return true;
    }

    if (confidence < 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Get available tools for the AI.
   */
  getAvailableTools(): OperatorTool[] {
    return OPERATOR_TOOLS;
  }
}

export const aiOperator = new PointWakeAIOperator();
