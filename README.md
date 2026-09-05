# Bridge

A universal translation and trust layer for agent-to-agent commerce, built for the Razorpay AI Buildathon (Track 01: AI Growth & Agentic Commerce).

## The problem

Agent-to-agent commerce is arriving through several incompatible protocols at once. Google's ACP, the AP2 mandate standard, x402's HTTP-native payment handshake, and NPCI's own Unified Agentic Protocol are all trying to become the way an AI buyer talks to a merchant, and none of them have won yet. A merchant who wants to be transactable by AI buyers today has no good option: pick one protocol and hope it survives, or try to integrate all of them separately and maintain that forever.

The real question isn't whether an agent can buy something from a merchant. It's what happens when several different agent ecosystems try to transact with the same merchant at once, using different formats, different trust assumptions, and different failure modes, and whether the merchant can stay in control of their own money through all of it.

## What Bridge does

Bridge sits between any number of buyer agents, regardless of which protocol they speak, and a merchant's Razorpay account. It does four things:

It translates every incoming request, whatever protocol it arrives in, into one internal canonical mandate format, so the rest of the system never has to think about protocol differences again.

It can learn new protocols on its own. An ingestion agent reads a protocol specification it has never seen and proposes a field mapping into the canonical format. That proposal does not get trusted automatically, which is the part described below.

It enforces one policy layer, set once by the merchant, no matter which protocol dialect a request came in through: spend ceilings per trust tier, discount floors, and rate limits.

It logs and explains every decision it makes in plain language, and it can freeze a misbehaving agent mid-flow if it detects abnormal behavior.

## Why the LLM is not trusted with money

The first version of this project used the ingestion agent's generated protocol adapter directly, and an early technical review of the architecture pointed out, correctly, that this is a bad idea for anything touching real money. An LLM inferring a field mapping from a spec it has never seen can get it wrong in ways that are expensive: mapping the wrong field to amount, dropping currency, or misreading a nested structure.

Bridge now treats the ingestion agent's output as a proposal, not an instruction. Every generated adapter goes through a separate, deterministic validator before it is allowed to touch a single live mandate. The validator checks that amount maps to a numeric field, that currency is present, that agent identity is present, and that no required canonical field was left unmapped. Until it passes all of these checks, that protocol lane is marked as pending validation, not active, and this state is visible in the interface rather than hidden.

The reasoning narrator works the same way. It has no write access to the mandate object or the execution path. It receives the policy engine's decision after that decision has already been made, and its only job is to explain it in plain English. If you removed the narrator entirely, no transaction outcome in the system would change. It exists for explainability, not for judgment.

The rule Bridge follows throughout: the LLM proposes and explains, a deterministic policy engine decides, and the database guarantees it only happens once.

## Idempotency and concurrency

Every mandate is written to the database under a unique constraint on its mandate ID. If two identical requests arrive at the same time, the database itself rejects the second one as a duplicate rather than relying on application code to catch the race. This was tested directly: a script fires ten identical mandates at the same instant, and the ledger confirms exactly one executes while the other nine are rejected as duplicates at the database layer. Without this, a burst of concurrent requests could slip past an application-level check before it has a chance to react.

## Architecture

```
                  AGENT INGRESS (Heterogeneous Protocols)
  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
  │   Google ACP Agent    │   │   NPCI / AP2 Agent    │   │  New / Custom Agent   │
  └───────────┬───────────┘   └───────────┬───────────┘   └───────────┬───────────┘
              │                           │                           │ (Raw Spec)
              ▼                           ▼                           ▼
      ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
      │  ACP Adapter  │           │  AP2 Adapter  │           │  LLM Ingest   │
      │  (Built-in)   │           │  (Built-in)   │           │  (Proposes)   │
      └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
              │                           │                           │ Proposal
              │                           │                           ▼
              │                           │               ┌───────────────────────┐
              │                           │               │ Deterministic Val.    │
              │                           │               │ (Numeric, Cur, ID)    │
              │                           │               └───────────┬───────────┘
              │                           │                           │ Validated
              └───────────────────────────┼───────────────────────────┘
                                          │
                                          ▼
                      ╔═══════════════════════════════════════╗
                      ║    CANONICAL MANDATE NORMALIZATION    ║
                      ║      HMAC-SHA256 Cryptographic        ║
                      ║      Spine Signature Verification     ║
                      ╚═══════════════════════════════════════╝
                                          │
                                          ▼
                      ╔═══════════════════════════════════════╗
                      ║       ATOMIC IDEMPOTENCY LAYER        ║
                      ║     SQLite UNIQUE(mandate_id)         ║
                      ║  (Rejects 10x concurrent races to 1)  ║
                      ╚═══════════════════════════════════════╝
                                          │
                                          ▼
                      ╔═══════════════════════════════════════╗
                      ║       DETERMINISTIC POLICY ENGINE     ║
                      ║  • Tier 1-3 Spend Caps & Discounts    ║
                      ║  • Circuit Breaker Rate Anomaly Check ║
                      ╚═══════════════════════════════════════╝
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │ [APPROVED & VALID]                          │ [DECISION EVENT]
                   ▼                                             ▼
    ╔═════════════════════════════╗               ╔═════════════════════════════╗
    ║   EXECUTION LAYER (MONEY)   ║               ║  REASONING NARRATOR (LLM)   ║
    ║   Razorpay Test Settlement  ║               ║  Plain-English Explanations ║
    ║   • Strictly Deterministic  ║               ║  • Read-Only Audit Log      ║
    ║   • Zero LLM in Money Path  ║               ║  • Zero Execution Power     ║
    ╚═════════════════════════════╝               ╚═════════════════════════════╝
```

A canonical mandate is the one shape every transaction is normalized into before it can touch money:

```
{
  "mandate_id": "unique identifier",
  "agent_id": "identity of the requesting buyer agent",
  "origin_protocol": "acp | ap2 | x402 | custom",
  "merchant_id": "merchant identifier",
  "items": [{ "sku": "...", "qty": 0, "unit_price": 0 }],
  "total_amount": 0,
  "currency": "INR",
  "spend_cap_checked_against": 0,
  "agent_trust_tier": 0,
  "status": "pending | approved | rejected | frozen | executed",
  "created_at": "timestamp",
  "expires_at": "timestamp",
  "signature": "HMAC-SHA256 signed hash of the above"
}
```

Two protocol adapters are built in and working end to end. A third is generated live by the ingestion agent from a specification it has not seen before, and goes through the validation step described above before it can process anything.

The policy engine holds the merchant's rules: a maximum auto-approved order value and a maximum discount per trust tier, and a rate limit that trips a circuit breaker if one agent identity fires too many requests too quickly. When the breaker trips, that agent's pending and in-flight mandates are frozen, the reason is logged, and the agent cannot transact again until a human reviews it.

Execution only happens against a mandate that has passed validation, passed policy, and is not a duplicate. It runs against Razorpay's test-mode APIs.

## Known limitations

This is a hackathon-scope build and it is worth being direct about where it stops short of a production system. It runs against Razorpay's test-mode APIs, not live payment rails. Order creation calls Razorpay's real test-mode Orders API when credentials are configured; payment capture is simulated locally, since a full checkout handshake was out of scope for this build. The demo uses a local database rather than a managed, durable one, which is fine for demonstrating the idempotency guarantee but would need a proper Postgres setup with the same unique-constraint pattern in production. The protocol adapters cover ACP, AP2, and one live-ingested third protocol; a production version would need this tested against the actual published specs of each protocol rather than representative mock schemas, since none of NPCI's UAP, ACP, AP2, or x402 has a single, final, universally agreed shape yet. Progressive trust scoring exists as a concept in the design but is not fully wired to persist and evolve across sessions in this build.

## Interface

The interface is built to look like a live systems console rather than a typical dashboard, because the product is about watching autonomous agents transact in real time and being able to see, and interrupt, what they're doing. The left panel is a raw, monospaced stream of every mandate as it moves through the system. The right panel is a slower-arriving, plain-English explanation of each decision, deliberately in a different typeface, so the contrast between machine output and human explanation is visible rather than just described. Color is used sparingly: everything is quiet by default, and the only saturated color on screen is reserved for the moment an agent is actually frozen.

## Running it locally

```bash
git clone https://github.com/anannya-b/Bridge.git
cd Bridge

cd backend
npm install
npm run dev

cd ../frontend
npm install
npm run dev
```

Set your Razorpay test-mode API keys in a `.env` file in the backend directory before starting it. The demo scenarios in the interface (Google ACP, NPCI/AP2, live protocol ingestion, a policy breach, and the kill switch) can be triggered directly from the console without needing to construct requests manually.

## Stack

Node.js backend, React frontend, SQLite for the demo's idempotency layer, Razorpay test-mode APIs for execution, and LLM calls for the protocol-ingestion proposal step and the reasoning narrator only, both of which are explicitly kept outside the execution path as described above.
