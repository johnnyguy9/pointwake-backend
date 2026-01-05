# PointWake AI CallOps Platform

## Overview
A production-ready multi-tenant AI-powered call operations platform that combines cloud PBX capabilities with intelligent dispatch. The system handles calls end-to-end using an AI operator: triage -> collect details -> dispatch -> confirm -> log -> follow-up.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **State Management**: TanStack React Query
- **Real-time**: WebSocket for live updates
- **Routing**: wouter
- **Storage**: PostgreSQL with Drizzle ORM

## Architecture

### Backend Services
- **PointWakeRulesEngine**: Deterministic decision-making for property/unit/vendor/escalation policy selection
- **PointWakeDispatchService**: Vendor dispatch, acknowledgment tracking, and escalation handling
- **PointWakeBillingService**: Usage tracking and billing estimates
- **TelephonyAdapter**: Abstraction layer for telephony providers (stubs - TODO: integrate Twilio/Vonage)
- **PointWakeAIOperator**: AI voice operator with tool-calling framework (TODO: integrate LLM provider)

### Data Models
- **Account**: Multi-tenant organization with billing settings
- **Location**: Physical location with business hours and routing strategy
- **User**: Team members with roles and availability status
- **Property**: Managed properties with preferred vendors
- **Unit**: Individual units within properties
- **Vendor**: Service providers by trade
- **EscalationPolicy**: Rules for escalation ladder
- **Incident**: Service tickets with audit trail
- **CallSession**: Call records with state machine tracking
- **UsageRecord**: Billing metrics

### API Routes
- `/api/auth/login` - Authentication
- `/api/users` - User management
- `/api/dashboard/stats` - Dashboard metrics
- `/api/calls` - Call session management
- `/api/incidents` - Incident/ticket management
- `/api/properties` - Property management
- `/api/units` - Unit management
- `/api/vendors` - Vendor management
- `/api/policies` - Escalation policies
- `/api/usage` - Usage records
- `/api/billing/estimate` - Billing estimates
- `/api/dispatch` - Dispatch operations
- `/api/rules/*` - Rules engine endpoints

### External AI Operator Endpoints (for voice agent integration)
- `POST /api/operator/incoming` - Twilio webhook for incoming calls (redirects to external AI)
- `POST /api/operator/transfer` - External AI requests transfer to location staff
- `POST /api/operator/transfer-connect` - TwiML for connecting transferred calls
- `POST /api/operator/transfer-status` - Transfer status callback
- `POST /api/operator/voicemail` - Voicemail recording handler
- `POST /api/operator/call-ended` - External AI notifies call completion
- `GET /api/operator/locations` - Get available locations for routing
- `GET /api/operator/session/:id` - Get call session info

### VoIP / Staff App Endpoints
- `POST /api/voip/token` - Generate Twilio Client token for staff app
- `POST /api/voip/register-device` - Register device for push notifications
- `POST /api/voip/presence` - Update user presence/availability
- `GET /api/voip/staff/:locationId` - Get staff status at location
- `GET /api/voip/devices` - Get user's registered devices
- `POST /api/voip/heartbeat` - Device heartbeat
- `POST /api/voip/call` - Twilio Client call handler

### Staff Management Endpoints
- `POST /api/staff/shift/start` - Start on-duty shift at location
- `POST /api/staff/shift/end` - End on-duty shift
- `GET /api/staff/shift` - Get current shift info
- `GET /api/staff/on-duty` - Get all on-duty staff
- `POST /api/staff/assign-location` - Assign staff to location
- `GET /api/staff/locations-summary` - Get locations with staff counts

### Call History Endpoints
- `GET /api/calls/history` - Get call history with filters
- `GET /api/calls/:callId` - Get call details with transcript
- `GET /api/calls/stats` - Get call statistics
- `GET /api/calls/export` - Export call history as CSV

### WebSocket Events
- `incoming_call` - New inbound call
- `call_updated` - Call state change
- `new_incident` - New incident created
- `incident_updated` - Incident status change
- `user_availability_changed` - User status change

## Development

### Running the App
```bash
npm run dev
```

### Demo Credentials
- Username: `admin`
- Password: `admin123`

### Database
The app uses PostgreSQL with Drizzle ORM. Schema is defined in `shared/schema.ts`.

To push schema changes:
```bash
npm run db:push
```

### Seed Data
In development mode, the app auto-seeds demo data on startup. The app is pre-seeded with:
- 1 demo account (PointWake Demo)
- 1 location (Main Office)
- 4 users (admin, 2 agents, on-call manager)
- 2 properties (River Oaks Apartments, Sunset Plaza)
- 8 units at River Oaks
- 4 vendors (HVAC x2, Plumbing, Electrical)
- 1 escalation policy
- 3 sample incidents
- Usage records for billing

## TODO Markers for Integration
- `server/services/TelephonyAdapter.ts`: Integrate telephony provider (Twilio/Vonage)
- `server/services/AIOperator.ts`: Integrate LLM provider (OpenAI/Anthropic)
- GHL Integration: Future enhancement

## Frontend Pages
- `/` - Dashboard with real-time stats
- `/calls` - Call log with filters
- `/incidents` - Incident management
- `/incidents/:id` - Incident detail view
- `/properties` - Property directory
- `/vendors` - Vendor management
- `/reports` - Analytics and billing
- `/settings` - User and AI settings
