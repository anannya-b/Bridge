/**
 * Base Protocol Adapter Interface
 */
export class BaseProtocolAdapter {
  constructor(protocolId, name, version) {
    this.protocolId = protocolId;
    this.name = name;
    this.version = version || '1.0';
    this.status = 'active'; // active | ingesting | error
  }

  /**
   * Translates incoming raw protocol payload into Canonical Mandate input
   * @param {object} rawPayload 
   * @param {object} context 
   * @returns {object} { agent_id, items, total_amount, currency, metadata }
   */
  normalize(rawPayload, context = {}) {
    throw new Error(`normalize() not implemented for ${this.name}`);
  }

  /**
   * Formats the execution / decision result back into protocol-specific response
   * @param {object} mandate 
   * @param {object} executionResult 
   * @returns {object}
   */
  formatResponse(mandate, executionResult) {
    return {
      protocol: this.protocolId,
      status: mandate.status,
      mandate_id: mandate.mandate_id,
      razorpay_order_id: executionResult?.orderId || null,
      timestamp: new Date().toISOString()
    };
  }
}
