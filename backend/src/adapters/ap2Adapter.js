import { BaseProtocolAdapter } from './baseAdapter.js';

/**
 * NPCI UAP / AP2 (Agent Payment Protocol) Adapter
 * Simulates Indian market agentic commerce payload:
 * {
 *   "uap_envelope": "1.2",
 *   "payer_agent": {
 *     "vpa": "b2b.restock.agent@axisbank",
 *     "agent_did": "did:npci:uap:in:retail_restock_08"
 *   },
 *   "transaction_request": {
 *     "line_items": [
 *       { "prod_code": "DAL_TOOR_5KG", "count": 3, "rate": 650 }
 *     ],
 *     "gross_val": 1950,
 *     "denomination": "INR"
 *   },
 *   "digital_token": "npci_sig_x893..."
 * }
 */
export class Ap2Adapter extends BaseProtocolAdapter {
  constructor() {
    super('ap2', 'NPCI UAP / AP2', '1.2');
  }

  normalize(rawPayload, context = {}) {
    if (!rawPayload) throw new Error('AP2/UAP payload is empty');

    const payer = rawPayload.payer_agent || {};
    const tx = rawPayload.transaction_request || {};
    const lineItems = tx.line_items || [];

    const agent_id = payer.agent_did || payer.vpa || rawPayload.agent_id || 'did:npci:uap:anonymous';

    const items = lineItems.map((item, idx) => ({
      sku: item.prod_code || item.sku || `PROD_${idx + 1}`,
      qty: Number(item.count || item.qty || 1),
      unit_price: Number(item.rate || item.unit_price || 0)
    }));

    const calculatedTotal = items.reduce((sum, item) => sum + (item.unit_price * item.qty), 0);
    const total_amount = tx.gross_val !== undefined 
      ? Number(tx.gross_val) 
      : (calculatedTotal || Number(rawPayload.amount || 0));

    return {
      agent_id,
      origin_protocol: 'ap2',
      merchant_id: rawPayload.merchant_vpa || context.merchant_id || 'kirana_test_04',
      items,
      total_amount,
      currency: tx.denomination || 'INR',
      metadata: {
        vpa: payer.vpa,
        uap_version: rawPayload.uap_envelope,
        digital_token: rawPayload.digital_token ? rawPayload.digital_token.slice(0, 16) + '...' : null
      }
    };
  }

  formatResponse(mandate, executionResult) {
    return {
      uap_ack: {
        status: mandate.status === 'executed' ? 'UAP_SETTLED' : (mandate.status === 'approved' ? 'UAP_ACCEPTED' : 'UAP_DECLINED'),
        mandate_ref: mandate.mandate_id,
        npci_txn_id: `npci_txn_${Date.now()}`,
        rzp_order_id: executionResult?.orderId || null,
        rzp_payment_id: executionResult?.paymentId || null,
        settled_inr: mandate.total_amount,
        timestamp: new Date().toISOString()
      }
    };
  }
}
