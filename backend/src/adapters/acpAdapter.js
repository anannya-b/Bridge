import { BaseProtocolAdapter } from './baseAdapter.js';

/**
 * Google ACP (Agent Commerce Protocol) Adapter
 * Simulates ACP standard request dialect:
 * {
 *   "acp_version": "2026.1",
 *   "buyer_agent": { "agent_urn": "urn:agent:google:acp:procure-bot-9", "trust_level": 1 },
 *   "order_intent": {
 *     "cart": [
 *       { "item_sku": "SKU_ATTA_10KG", "quantity": 2, "price_inr": 420 },
 *       { "item_sku": "SKU_MUSTARD_OIL_1L", "quantity": 1, "price_inr": 180 }
 *     ],
 *     "currency": "INR",
 *     "declared_total": 1020
 *   },
 *   "auth_token": "acp_sig_8fa726b..."
 * }
 */
export class AcpAdapter extends BaseProtocolAdapter {
  constructor() {
    super('acp', 'Google ACP', '2026.1');
  }

  normalize(rawPayload, context = {}) {
    if (!rawPayload) throw new Error('ACP payload is empty');

    const buyerAgent = rawPayload.buyer_agent || {};
    const orderIntent = rawPayload.order_intent || {};
    const cart = orderIntent.cart || [];

    const agent_id = buyerAgent.agent_urn || rawPayload.agent_id || 'urn:agent:acp:anonymous';

    const items = cart.map((item, idx) => ({
      sku: item.item_sku || item.sku || `ITEM_${idx + 1}`,
      qty: Number(item.quantity || item.qty || 1),
      unit_price: Number(item.price_inr || item.unit_price || 0)
    }));

    const calculatedTotal = items.reduce((sum, item) => sum + (item.unit_price * item.qty), 0);
    const total_amount = orderIntent.declared_total !== undefined 
      ? Number(orderIntent.declared_total) 
      : (calculatedTotal || Number(rawPayload.amount || 0));

    return {
      agent_id,
      origin_protocol: 'acp',
      merchant_id: rawPayload.merchant_id || context.merchant_id || 'kirana_test_04',
      items,
      total_amount,
      currency: orderIntent.currency || 'INR',
      metadata: {
        raw_acp_version: rawPayload.acp_version,
        auth_token_hash: rawPayload.auth_token ? rawPayload.auth_token.slice(0, 16) + '...' : null
      }
    };
  }

  formatResponse(mandate, executionResult) {
    return {
      acp_envelope_version: '2026.1',
      response_type: 'ACP_MANDATE_DECISION',
      status: mandate.status === 'executed' ? 'ACP_SUCCESS' : (mandate.status === 'approved' ? 'ACP_AUTHORIZED' : 'ACP_REJECTED'),
      canonical_mandate_id: mandate.mandate_id,
      authorization: {
        authorized_amount: mandate.total_amount,
        currency: mandate.currency,
        razorpay_reference: executionResult?.orderId || null,
        payment_id: executionResult?.paymentId || null
      },
      signature: mandate.signature,
      settlement_gateway: 'RAZORPAY_TEST_MODE'
    };
  }
}
