# BRIDGE
### A Universal Translation and Trust Layer for Agent-to-Agent Commerce
**Razorpay AI Buildathon — Track 01: AI Growth & Agentic Commerce**

---

## 1. The Problem

Agent-to-agent commerce is arriving through multiple, incompatible protocols at once: **Google ACP**, **AP2 / NPCI UAP**, **x402's HTTP-native payment handshake**, and emerging agentic schemas. 

No merchant can safely integrate with all of them, and none of them will fully win before the market has to start transacting.

**The open problem isn't "can an agent buy something." It's: what happens when five incompatible agent economies all show up at the same merchant at once, and how does that merchant stay in control of their own money while it happens.**

Bridge is that infrastructure.

---

## 2. What Bridge Does

Bridge sits between any number of autonomous buyer agents — regardless of which protocol dialect they speak — and the merchant's actual Razorpay account.

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│    Google ACP Agent    │      │    NPCI / AP2 Agent    │      │    x402 Agent (New)    │
└───────────┬────────────┘      └───────────┬────────────┘      └───────────┬────────────┘
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
    │  ACP Adapter  │               │  AP2 Adapter  │               │ Dynamic x402  │
    └───────┬───────┘               └───────┬───────┘               └───────┬───────┘
            │                               │                               ▲
            └───────────────────────┬───────────────────────────────────────┘
                                    │ Live Compilation by Ingestion Agent
                                    ▼
              ╔═══════════════════════════════════════════════╗
              ║       CANONICAL MANDATE SPINE (SIGNED)        ║
              ╚═══════════════════════════════════════════════╝
                                    │
                                    ▼
              ╔═══════════════════════════════════════════════╗
              ║                 POLICY ENGINE                 ║
              ║  • Spend Ceilings (Tier 1: ₹1k, Tier 2: ₹3k)  ║
              ║  • Progressive Trust Escalation               ║
              ║  • Circuit Breaker / Kill Switch              ║
              ╚═══════════════════════════════════════════════╝
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
     ┌─────────────────────────────┐ ┌─────────────────────────────┐
     │  Reasoning Narrator (LLM)   │ │      Execution Layer        │
     │  Plain-English live trace   │ │  Razorpay Test Settlement   │
     └─────────────────────────────┘ └─────────────────────────────┘
```

1. **Translates** incoming agent payloads into one **Signed Canonical Mandate** (`HMAC-SHA256`).
2. **Learns Unseen Protocols Live.** The Protocol Ingestion Agent reads protocol specifications and generates a working translator into the runtime on the fly.
3. **Enforces Policy & Trust Tiers.** Max auto-approve thresholds per agent tier, discount floors, and progressive trust ratings.
4. **Circuit Breaker Kill Switch.** Detects rapid-fire burst hammering and escalating attacks, instantly freezing the agent identity and pulsing the ledger rust-red.
5. **Real-time Reasoning Narrator.** Explains every approval, rejection, and policy escalation in plain English with intentional typewriter pacing.
6. **Execution Layer.** Settles approved mandates against Razorpay test-mode APIs.

---

## 3. Visual & Aesthetic Discipline

The Bridge interface is built as a **trading-floor risk desk / air-traffic control console**:
- **Strict 5-Color Palette**: Base (`#0A0D12`), Text (`#E8EAED`), Chrome (`#5B7A9D`), Approve (`#3DD68C`), Reject (`#E8543E`).
- **Dual Typography**: Monospace (`JetBrains Mono`) for machine output & hashes; Grotesk Sans (`Inter`) for the reasoning trace.
- **No AI-slop tells**: No rounded SaaS fluff, no decorative drop-shadows, no generic gradient backgrounds.

---

## 4. Quick Start

### Prerequisites
- Node.js >= 18
- npm

### Installation
```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Running the Core Tests
```bash
cd backend && npm test
```
*Output: 21 unit & integration tests covering Canonical Mandate signatures, ACP/AP2 adapters, live x402 ingestion synthesis, Policy Engine ceilings, Kill Switch circuit breaker, and Razorpay test execution.*

### Starting Bridge Gateway & Console
In Terminal 1 (Backend):
```bash
npm run start:backend
# Listening on http://localhost:3001 & ws://localhost:3001
```

In Terminal 2 (Frontend):
```bash
npm run start:frontend
# Vite dev server running on http://localhost:5173
```

---

## 5. Live Demo Flight (90 Seconds)

1. **Steady State**: Open console (`http://localhost:5173`) — header displays merchant ID (`kirana_test_04`) and live status.
2. **Step 1: Google ACP**: Click `1. Google ACP` — Translates cart into signed canonical mandate, approves under Tier 1 ceiling, executes Razorpay test settlement.
3. **Step 2: Progressive Trust Escalation**: Click `1. Google ACP` again — Agent trust tier automatically elevates to Tier 2 (expanding auto-approve ceiling to ₹3,000).
4. **Step 3: NPCI / AP2**: Click `2. NPCI / AP2` — Ingests Indian agentic commerce payload (₹1,950), checks VPA, normalizes, executes.
5. **Step 4: Live Protocol Ingestion**: Click `3. Ingest x402 Spec` — Ingestion Agent parses unseen x402 spec, displays live progress bar in bottom lane (`x402 ingesting...`), registers dynamic adapter, and immediately executes a transaction.
6. **Step 5: Policy Breach**: Click `4. Policy Breach (4,200 INR)` — Tier 1 agent attempts purchase exceeding ceiling. Gateway rejects with plain-English audit reasoning.
7. **Step 6: Kill Switch Circuit Breaker**: Click `5. Trigger Kill Switch` — Rogue agent fires rapid bursts with high-value items; circuit breaker trips, identity is locked, mandate stream freezes mid-stream, and the row pulses rust-red.
8. **Step 7: Mandate Inspector**: Click any row in the mandate stream to inspect the signed JSON schema, HMAC-SHA256 signature, and Razorpay receipt.

---

## 6. Project Structure

```
Bridge/
├── backend/
│   ├── src/
│   │   ├── core/canonicalMandate.js       # Canonical mandate schema & HMAC-SHA256 signing
│   │   ├── adapters/                      # ACP, AP2, BaseAdapter & dynamic registry
│   │   ├── ingestion/protocolIngestionAgent.js # Live protocol specification synthesizer
│   │   ├── policy/policyEngine.js         # Trust tiers & spend cap enforcement
│   │   ├── policy/killSwitch.js           # Circuit breaker & burst attack detector
│   │   ├── narrator/reasoningNarrator.js  # Real-time plain-English justification engine
│   │   ├── execution/razorpayClient.js    # Razorpay test mode payment execution
│   │   └── server.js                      # Express + WebSocket streaming server
│   └── tests/testRunner.js                # Core unit & integration test suite
├── frontend/
│   ├── src/
│   │   ├── components/                    # Header, MandateStream, ReasoningNarratorView,
│   │   │                                  # ProtocolLanes, ScenarioDock, MandateDetailModal
│   │   ├── App.jsx                        # Master console UI state & WebSocket client
│   │   └── index.css                      # 5-color precision risk desk styling
│   ├── index.html                         # Typography & viewport config
│   └── vite.config.js
└── protocols/                             # Spec definitions for ACP, AP2, x402
```
