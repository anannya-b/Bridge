# x402 Protocol Specification (HTTP-Native Agent Payment Handshake)

## Protocol Identifier
- **Protocol**: `x402`
- **Standard**: RFC-Draft-Agentic-Commerce-x402
- **Version**: `1.0.4`

## Overview
The x402 standard enables autonomous AI agents to initiate programmatic HTTP-native payments directly against web endpoints via standard HTTP 402 / 200 handshakes.

## Request Envelope Structure
Incoming transaction requests arrive formatted as:

```json
{
  "x_protocol": "x402-v1",
  "headers": {
    "x_agent_id": "did:agent:x402:autonomous_buyer_402",
    "x_auth_proof": "0x8892fbc9471182309aaee"
  },
  "body": {
    "purchase_orders": [
      {
        "item_id": "SKU_PREMIUM_BASMATI_5KG",
        "units": 2,
        "price_per_unit": 540
      },
      {
        "item_id": "SKU_ORGANIC_GHEE_500ML",
        "units": 1,
        "price_per_unit": 620
      }
    ],
    "settlement_amount": 1700,
    "currency": "INR",
    "callback_url": "https://agent.x402.network/settle"
  }
}
```

## Normalization Expectations for Gateway
1. **Agent ID**: Extracted from `headers.x_agent_id` or `body.payer_did`.
2. **Items Cart**: Extracted from `body.purchase_orders` with items having `item_id` (sku), `units` (qty), and `price_per_unit` (unit_price).
3. **Total Amount**: `body.settlement_amount` denominated in `body.currency` (default INR).
4. **Signature/Proof**: Verifiable cryptographic proof from `headers.x_auth_proof`.
