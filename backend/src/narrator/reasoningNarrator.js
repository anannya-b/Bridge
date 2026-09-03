/**
 * Live Reasoning Narrator
 * Produces plain-English system explanations of gateway decisions
 */
export class ReasoningNarrator {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || null;
  }

  /**
   * Generates real-time plain English explanation for a mandate evaluation
   * @param {object} params
   * @returns {Promise<string>}
   */
  async explainDecision({ mandate, evaluation, killCheck, originProtocolName, agentState }) {
    // If kill switch triggered
    if (killCheck?.tripped) {
      if (killCheck.type === 'BURST_ATTACK') {
        return `Circuit breaker engaged — Agent identity "${mandate.agent_id}" fired ${killCheck.metrics?.requestCount || 'rapid'} transactional requests within 2.5s. System halted execution to prevent inventory exhaustion and locked agent to frozen state.`;
      }
      if (killCheck.type === 'ESCALATING_RAMP') {
        return `Anomaly detected — Identity "${mandate.agent_id}" attempted an escalating ramp-up (${killCheck.metrics?.amounts?.map(a => '₹' + a.toLocaleString()).join(' -> ')}). Circuit breaker engaged, freezing agent permissions immediately.`;
      }
      return `Circuit breaker action — Agent "${mandate.agent_id}" halted. Reason: ${killCheck.reason}`;
    }

    // If agent is frozen
    if (agentState?.is_frozen) {
      return `Rejected — Buyer agent "${mandate.agent_id}" is currently locked in frozen state due to policy violation (${agentState.frozen_reason || 'Policy lockout'}). All routing suspended.`;
    }

    const tier = evaluation.agent_trust_tier || 1;
    const ceiling = evaluation.spend_cap_checked_against || 1000;
    const amount = mandate.total_amount;
    const itemsList = mandate.items?.map(i => `${i.qty}x ${i.sku}`).join(', ') || 'itemized inventory';

    if (evaluation.decision === 'approved') {
      const remainingAllowance = ceiling - amount;
      const successCount = agentState?.successful_tx_count || 1;
      const tierProgressionText = tier < 3 
        ? ` Trust tier ${tier} active (${successCount} settled txs, auto-ceiling ₹${ceiling.toLocaleString()}).`
        : ` Verified Tier 3 partner standing.`;

      return `Authorized — Received ${originProtocolName} envelope for ₹${amount.toLocaleString()} (${itemsList}).${tierProgressionText} Signed canonical mandate and routed to Razorpay test settlement. ₹${remainingAllowance.toLocaleString()} headroom remaining in tier ceiling.`;
    }

    if (evaluation.decision === 'held_for_review') {
      const overage = amount - ceiling;
      return `Held for review — Buyer agent requested ₹${amount.toLocaleString()} for ${itemsList}, exceeding Tier ${tier} auto-approval ceiling of ₹${ceiling.toLocaleString()} by ₹${overage.toLocaleString()}. Mandate cryptographically quarantined; merchant notification dispatched for manual approval.`;
    }

    if (evaluation.decision === 'rejected') {
      return `Rejected — Transaction total ₹${amount.toLocaleString()} breaches maximum allowable bound for Tier ${tier} (${evaluation.breachReason || 'Spend limit exceeded'}). Gateway refused mandate signature and emitted 403 Policy Rejection.`;
    }

    return `Processed mandate ${mandate.mandate_id} via ${originProtocolName}: Status ${mandate.status}.`;
  }
}

export const reasoningNarrator = new ReasoningNarrator();
