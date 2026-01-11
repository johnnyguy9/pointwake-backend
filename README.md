# PointWake AI CallOps Platform

Enterprise-grade AI-powered call operations platform with intelligent dispatch, multi-tenant support, real-time call management, and **Wake Analyzer** data analytics.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Add these to Replit Secrets (or `.env` locally):

```bash
# Required - Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_API_KEY=SKxxxxx
TWILIO_API_SECRET=xxxxx
TWILIO_PHONE_NUMBER=+18445247683

# Required - Vapi
VAPI_API_KEY=xxxxx

# Required - OpenAI (for any direct AI features)
OPENAI_API_KEY=sk-xxxxx

# Required - App Config
BASE_URL=https://your-app-url.com

# Set after running bootstrap
DEFAULT_ACCOUNT_ID=
```

### 3. Initialize Database
```bash
npm run db:push
```

### 4. Create Initial Account
```bash
npm run bootstrap
```

This creates:
- Default account linked to your phone number
- Admin user: `admin` / `admin123`
- Staff user: `staff` / `staff123`
- Default location: "Main Office"

**Copy the `DEFAULT_ACCOUNT_ID` from the output and add it to your secrets!**

### 5. Configure Vapi
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Select your phone number
3. Set **Server URL** to: `https://your-app-url/webhooks/vapi/server-url`
4. Save

### 6. Start the Server
```bash
npm run dev
```

### 7. Test It
1. Open your app URL in browser
2. Login with `admin` / `admin123`
3. Click "Go Online" in the SoftPhone (bottom right)
4. Call your Vapi phone number
5. Watch the dashboard update in real-time!

---

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌─────────────────────┐
│   Caller    │────▶│   Vapi   │────▶│  PointWake Backend  │
│   Phone     │     │   AI     │     │  /webhooks/vapi/*   │
└─────────────┘     └──────────┘     └─────────────────────┘
                         │                     │
                         │ Tools:              │ Real-time:
                         │ - check_availability│ - WebSocket
                         │ - schedule_viewing  │ - Dashboard
                         │ - create_incident   │ - SoftPhone
                         │ - transfer_to_human │
                         ▼                     ▼
                    ┌──────────┐     ┌─────────────────────┐
                    │  Twilio  │────▶│   Staff Browser     │
                    │  Client  │     │   (WebRTC)          │
                    └──────────┘     └─────────────────────┘
```

## Key Features

- **AI-First Answering**: Vapi handles initial call with your custom prompt
- **Smart Routing**: Transfers route to available staff via browser (no personal phones)
- **Real-Time Dashboard**: See calls, incidents, and team status live
- **Multi-Tenant**: Full account isolation for multiple clients
- **Usage Billing**: Track AI minutes and generate billing estimates

## API Endpoints

### Vapi Webhooks
- `POST /webhooks/vapi/server-url` - Main Vapi webhook handler

### VoIP
- `POST /api/voip/token` - Get Twilio Client token
- `POST /api/voip/presence` - Update availability status

### Health
- `GET /api/vapi/health` - Check Vapi configuration status

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── SoftPhone.tsx      # Browser phone UI
│   │   ├── hooks/
│   │   │   └── useTwilioClient.ts # WebRTC hook
│   │   └── pages/
├── server/
│   ├── services/
│   │   ├── VapiIntegration.ts     # Vapi webhook handler
│   │   ├── VoIPService.ts         # Twilio Client tokens
│   │   └── BillingService.ts      # Usage tracking
│   └── routes.ts
├── shared/
│   └── schema.ts           # Database schema
└── script/
    └── bootstrap.ts        # Initial setup
```

## Troubleshooting

### "No account found for number"
- Run `npm run bootstrap` to create initial account
- Verify `DEFAULT_ACCOUNT_ID` is set in environment
- Check that `mainPhoneNumber` matches your Vapi number

### SoftPhone not connecting
- Check browser console for errors
- Verify `TWILIO_API_KEY` and `TWILIO_API_SECRET` are set
- Ensure you're logged in before clicking "Go Online"

### Calls not showing in dashboard
- Verify WebSocket connection (check ConnectionStatus component)
- Check server logs for Vapi webhook events
- Ensure `BASE_URL` is set correctly

## Wake Analyzer

PointWake includes **Wake Analyzer**, a conversational data analysis platform that provides:
- CSV data upload and analysis
- Python-powered analytics (pandas, numpy, sklearn, statsmodels)
- Zero AI hallucination (all results from actual execution)
- Chart generation (matplotlib, seaborn)
- Multi-tenant data isolation

### Quick Start

See [WAKE_ANALYZER.md](./WAKE_ANALYZER.md) for detailed setup instructions.

**Basic Setup:**
```bash
# Install Python dependencies
cd wake-analyzer-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start Python service
python run.py

# In another terminal, start Node.js
npm run dev
```

Access Wake Analyzer at `/wake-analyzer` in the UI.

## Support

- **Vapi Docs**: https://docs.vapi.ai
- **Twilio Client**: https://www.twilio.com/docs/voice/client
- **Wake Analyzer**: See [WAKE_ANALYZER.md](./WAKE_ANALYZER.md)

---

Built with ❤️ for property management teams
