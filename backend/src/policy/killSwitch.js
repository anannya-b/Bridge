import { policyEngine } from './policyEngine.js';

export class KillSwitch {
  constructor() {
    this.agentHistory = new Map(); // agentId -> array of { timestamp, amount, mandateId }
    this.killEvents = [];
    this.globalEmergencyHalt = false;
  }

  setGlobalEmergencyHalt(halted) {
    this.globalEmergencyHalt = halted;
    return this.globalEmergencyHalt;
  }

  /**
   * Evaluates if the incoming request constitutes an anomaly / burst attack
   * @param {object} mandate 
   * @returns {object} { tripped: boolean, reason?: string, metrics?: object }
   */
  check(mandate) {
    if (this.globalEmergencyHalt) {
      policyEngine.freezeAgent(mandate.agent_id, 'Merchant Global Emergency Halt is ACTIVE');
      return {
        tripped: true,
        reason: 'MERCHANT_GLOBAL_HALT: All agent transactions suspended by merchant operator.',
        type: 'GLOBAL_HALT'
      };
    }

    const now = Date.now();
    const history = this.agentHistory.get(mandate.agent_id) || [];
    
    // Prune history older than 10 seconds
    const recent = history.filter(h => now - h.timestamp < 10000);
    recent.push({ timestamp: now, amount: mandate.total_amount, mandateId: mandate.mandate_id });
    this.agentHistory.set(mandate.agent_id, recent);

    // Rule 1: Rapid-fire Burst (>= 4 requests in <= 2500ms)
    const window2500 = recent.filter(h => now - h.timestamp <= 2500);
    if (window2500.length >= 4) {
      const reason = `RAPID_BURST_ATTACK: Agent emitted ${window2500.length} requests in 2.5s window. Circuit breaker tripped to prevent denial-of-inventory.`;
      policyEngine.freezeAgent(mandate.agent_id, reason);
      
      const event = {
        agent_id: mandate.agent_id,
        mandate_id: mandate.mandate_id,
        type: 'BURST_ATTACK',
        reason,
        metrics: { requestCount: window2500.length, windowMs: 2500 },
        timestamp: new Date().toISOString()
      };
      this.killEvents.unshift(event);
      return { tripped: true, ...event };
    }

    // Rule 2: Rapid Escalating Value Attack (3 requests within 5s where amount escalates >1.8x each time)
    const window5000 = recent.filter(h => now - h.timestamp <= 5000);
    if (window5000.length >= 3) {
      const last3 = window5000.slice(-3);
      const isEscalating = last3[1].amount > last3[0].amount * 1.5 && last3[2].amount > last3[1].amount * 1.5;
      if (isEscalating && last3[2].amount > 2000) {
        const reason = `ESCALATING_VALUE_ATTACK: Rapid ramp detected (₹${last3[0].amount} -> ₹${last3[1].amount} -> ₹${last3[2].amount}) within 5s. Identity auto-frozen.`;
        policyEngine.freezeAgent(mandate.agent_id, reason);
        
        const event = {
          agent_id: mandate.agent_id,
          mandate_id: mandate.mandate_id,
          type: 'ESCALATING_RAMP',
          reason,
          metrics: { amounts: last3.map(l => l.amount) },
          timestamp: new Date().toISOString()
        };
        this.killEvents.unshift(event);
        return { tripped: true, ...event };
      }
    }

    return { tripped: false };
  }

  getKillEvents(limit = 20) {
    return this.killEvents.slice(0, limit);
  }
}

export const killSwitch = new KillSwitch();
