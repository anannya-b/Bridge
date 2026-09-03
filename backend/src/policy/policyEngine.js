/**
 * Merchant Policy Rules & Progressive Trust Tier Engine
 */

export const TIER_POLICIES = {
  1: {
    tier: 1,
    name: 'Standard Agent (Unverified)',
    max_auto_approve_amount: 1000,
    max_discount_pct: 5,
    max_tx_per_min: 5,
    require_manual_review_threshold: 1500
  },
  2: {
    tier: 2,
    name: 'Verified Agent (Established)',
    max_auto_approve_amount: 3000,
    max_discount_pct: 10,
    max_tx_per_min: 15,
    require_manual_review_threshold: 4500
  },
  3: {
    tier: 3,
    name: 'Trusted Partner Agent (High Volume)',
    max_auto_approve_amount: 10000,
    max_discount_pct: 15,
    max_tx_per_min: 30,
    require_manual_review_threshold: 15000
  }
};

export class PolicyEngine {
  constructor() {
    // In-memory agent state: agent_id -> { trust_tier, successful_tx_count, failed_tx_count, is_frozen, frozen_reason, last_tx_time }
    this.agentStates = new Map();
    this.policyAuditLog = [];
  }

  getAgentState(agentId) {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        agent_id: agentId,
        trust_tier: 1,
        successful_tx_count: 0,
        failed_tx_count: 0,
        is_frozen: false,
        frozen_reason: null,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      });
    }
    return this.agentStates.get(agentId);
  }

  setAgentTrustTier(agentId, tier) {
    const state = this.getAgentState(agentId);
    state.trust_tier = Math.max(1, Math.min(3, tier));
    state.last_updated = new Date().toISOString();
    return state;
  }

  freezeAgent(agentId, reason) {
    const state = this.getAgentState(agentId);
    state.is_frozen = true;
    state.frozen_reason = reason;
    state.last_updated = new Date().toISOString();
    return state;
  }

  unfreezeAgent(agentId) {
    const state = this.getAgentState(agentId);
    state.is_frozen = false;
    state.frozen_reason = null;
    state.last_updated = new Date().toISOString();
    return state;
  }

  /**
   * Evaluates incoming canonical mandate against merchant rules & agent tier
   * @param {object} mandate 
   * @returns {object} { decision: 'approved' | 'rejected' | 'held_for_review', checks: [], ceiling, reason }
   */
  evaluateMandate(mandate) {
    const agentState = this.getAgentState(mandate.agent_id);
    const tier = agentState.trust_tier;
    const policy = TIER_POLICIES[tier] || TIER_POLICIES[1];

    const checks = [];
    let decision = 'approved';
    let breachReason = null;

    // 1. Check if agent identity is frozen (Circuit breaker / Blacklist)
    const isFrozenCheck = {
      rule: 'AGENT_FREEZE_STATUS',
      passed: !agentState.is_frozen,
      details: agentState.is_frozen 
        ? `Agent is frozen: "${agentState.frozen_reason}"` 
        : 'Agent identity active & unfrozen'
    };
    checks.push(isFrozenCheck);
    if (!isFrozenCheck.passed) {
      decision = 'rejected';
      breachReason = isFrozenCheck.details;
    }

    // 2. Check Spend Ceiling against agent's trust tier
    const ceiling = policy.max_auto_approve_amount;
    const isAmountPass = mandate.total_amount <= ceiling;
    const amountCheck = {
      rule: 'SPEND_CAP_CEILING',
      passed: isAmountPass,
      details: isAmountPass 
        ? `Amount ₹${mandate.total_amount.toLocaleString()} is within Tier ${tier} ceiling (₹${ceiling.toLocaleString()})`
        : `Amount ₹${mandate.total_amount.toLocaleString()} breaches Tier ${tier} ceiling (₹${ceiling.toLocaleString()})`
    };
    checks.push(amountCheck);

    if (decision === 'approved' && !isAmountPass) {
      if (mandate.total_amount <= policy.require_manual_review_threshold) {
        decision = 'held_for_review';
        breachReason = `Amount ₹${mandate.total_amount.toLocaleString()} exceeds Tier ${tier} auto-cap of ₹${ceiling.toLocaleString()}; held for merchant manual approval`;
      } else {
        decision = 'rejected';
        breachReason = `Amount ₹${mandate.total_amount.toLocaleString()} exceeds Tier ${tier} absolute ceiling of ₹${ceiling.toLocaleString()}`;
      }
    }

    // 3. Currency Check
    const currencyCheck = {
      rule: 'CURRENCY_WHITELIST',
      passed: mandate.currency === 'INR',
      details: mandate.currency === 'INR' ? 'Settlement currency INR verified' : `Unsupported currency: ${mandate.currency}`
    };
    checks.push(currencyCheck);
    if (decision === 'approved' && !currencyCheck.passed) {
      decision = 'rejected';
      breachReason = currencyCheck.details;
    }

    const evaluationRecord = {
      mandate_id: mandate.mandate_id,
      agent_id: mandate.agent_id,
      agent_trust_tier: tier,
      spend_cap_checked_against: ceiling,
      total_amount: mandate.total_amount,
      decision,
      breachReason,
      checks,
      evaluated_at: new Date().toISOString()
    };

    this.policyAuditLog.unshift(evaluationRecord);
    return evaluationRecord;
  }

  /**
   * Progressive trust update on transaction completion
   */
  recordTransactionResult(agentId, success) {
    const state = this.getAgentState(agentId);
    if (success) {
      state.successful_tx_count += 1;
      // Promote tier after 3 successful transactions
      if (state.trust_tier === 1 && state.successful_tx_count >= 3) {
        state.trust_tier = 2;
      } else if (state.trust_tier === 2 && state.successful_tx_count >= 8) {
        state.trust_tier = 3;
      }
    } else {
      state.failed_tx_count += 1;
    }
    state.last_updated = new Date().toISOString();
    return state;
  }

  getAuditLog(limit = 50) {
    return this.policyAuditLog.slice(0, limit);
  }
}

export const policyEngine = new PolicyEngine();
