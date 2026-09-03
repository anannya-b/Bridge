import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { createCanonicalMandate, updateMandateStatus } from './core/canonicalMandate.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { protocolIngestionAgent } from './ingestion/protocolIngestionAgent.js';
import { policyEngine, TIER_POLICIES } from './policy/policyEngine.js';
import { killSwitch } from './policy/killSwitch.js';
import { reasoningNarrator } from './narrator/reasoningNarrator.js';
import { razorpayClient } from './execution/razorpayClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In-memory records
const recentMandates = [];
const recentNarrations = [];

// Broadcast utility
function broadcast(event, data) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    event: 'INIT_STATE',
    data: {
      merchant: {
        merchant_id: 'kirana_test_04',
        name: 'Sharma Daily Mart & Kirana (B2B Agent Hub)',
        currency: 'INR',
        mode: 'LIVE_TEST'
      },
      adapters: adapterRegistry.listAdapters(),
      policies: TIER_POLICIES,
      recentAudit: policyEngine.getAuditLog(15),
      recentMandates: recentMandates.slice(0, 30),
      recentNarrations: recentNarrations.slice(0, 30)
    }
  }));
});

// Realistic Kirana / Grocery Inventory Catalog
const INVENTORY_CATALOG = [
  { sku: 'SKU_FORTUNE_SUNFLOWER_15L', name: 'Fortune Sunflower Oil 15L Tin', base_price: 1850 },
  { sku: 'SKU_AASHIRVAAD_ATTA_10KG', name: 'Aashirvaad Shudh Chakki Atta 10kg', base_price: 430 },
  { sku: 'SKU_TATA_SALT_CRATE_24PK', name: 'Tata Iodized Salt 1kg (Crate 24pk)', base_price: 570 },
  { sku: 'SKU_MDH_DEGGI_MIRCH_1KG', name: 'MDH Deggi Mirch Powder 1kg Pack', base_price: 490 },
  { sku: 'SKU_AMUL_COW_GHEE_1L', name: 'Amul Pure Cow Ghee 1L Tin', base_price: 640 },
  { sku: 'SKU_INDIA_GATE_CLASSIC_10KG', name: 'India Gate Basmati Rice Classic 10kg', base_price: 1180 },
  { sku: 'SKU_SURF_EXCEL_MATIC_6KG', name: 'Surf Excel Matic Front Load 6kg', base_price: 1240 },
  { sku: 'SKU_FORTUNE_MUSTARD_OIL_5L', name: 'Fortune Kachi Ghani Mustard Oil 5L', base_price: 820 },
  { sku: 'SKU_EVEREST_GARAM_MASALA_1KG', name: 'Everest Garam Masala 1kg Bulk Pack', base_price: 780 },
  { sku: 'SKU_TATA_TEA_PREMIUM_1KG', name: 'Tata Tea Premium 1kg Pack', base_price: 460 },
  { sku: 'SKU_DAAWAT_ROZANA_10KG', name: 'Daawat Rozana Super Basmati 10kg', base_price: 890 },
  { sku: 'SKU_CASHEW_W320_BULK_5KG', name: 'Premium Cashews W320 5kg Bulk Box', base_price: 3850 },
  { sku: 'SKU_CALIFORNIA_ALMONDS_10KG', name: 'California Whole Almonds 10kg Box', base_price: 7200 },
  { sku: 'SKU_SAFFRON_KASHMIR_50G', name: 'Pure Kashmir Mogra Saffron 50g Pack', base_price: 12500 },
  { sku: 'SKU_PISTA_IRANIAN_5KG', name: 'Iranian Roasted Salted Pistachios 5kg', base_price: 5600 }
];

function getRandomItem(excludeIndices = []) {
  const available = INVENTORY_CATALOG.filter((_, idx) => !excludeIndices.includes(idx));
  const chosen = available[Math.floor(Math.random() * available.length)];
  return { ...chosen };
}

/**
 * Core Gateway Pipeline
 */
async function processGatewayTransaction(protocolId, rawPayload, options = {}) {
  const adapter = adapterRegistry.getAdapter(protocolId);
  if (!adapter) {
    throw new Error(`Unknown or unregistered protocol: "${protocolId}".`);
  }

  broadcast('INCOMING_REQUEST', {
    protocolId,
    adapterName: adapter.name,
    rawPayloadSummary: typeof rawPayload === 'object' ? Object.keys(rawPayload) : 'raw'
  });

  // 1. Normalization into Canonical Mandate
  const normalized = adapter.normalize(rawPayload, { merchant_id: 'kirana_test_04' });
  const agentStateBefore = policyEngine.getAgentState(normalized.agent_id);
  
  let mandate = createCanonicalMandate({
    ...normalized,
    agent_trust_tier: agentStateBefore.trust_tier,
    spend_cap_checked_against: TIER_POLICIES[agentStateBefore.trust_tier]?.max_auto_approve_amount || 1000,
    status: 'pending'
  });

  broadcast('MANDATE_CREATED', { mandate });

  // 2. Kill Switch / Circuit Breaker Check
  const killCheck = killSwitch.check(mandate);
  let evaluation;
  let executionResult = null;

  if (killCheck.tripped) {
    mandate = updateMandateStatus(mandate, 'frozen', { reason: killCheck.reason });
    broadcast('KILL_SWITCH_TRIPPED', {
      mandate_id: mandate.mandate_id,
      agent_id: mandate.agent_id,
      killCheck
    });
    evaluation = {
      mandate_id: mandate.mandate_id,
      agent_id: mandate.agent_id,
      decision: 'rejected',
      breachReason: killCheck.reason,
      checks: [{ rule: 'CIRCUIT_BREAKER_KILL_SWITCH', passed: false, details: killCheck.reason }]
    };
  } else {
    // 3. Policy Engine Evaluation
    evaluation = policyEngine.evaluateMandate(mandate);
    
    if (evaluation.decision === 'approved') {
      mandate = updateMandateStatus(mandate, 'approved');
      
      // 4. Execution via Razorpay
      try {
        executionResult = await razorpayClient.executeMandatePayment(mandate);
        mandate = updateMandateStatus(mandate, 'executed', { razorpay_order_id: executionResult.orderId });
        policyEngine.recordTransactionResult(mandate.agent_id, true);
        
        broadcast('PAYMENT_EXECUTED', {
          mandate_id: mandate.mandate_id,
          executionResult
        });
      } catch (execErr) {
        mandate = updateMandateStatus(mandate, 'rejected', { reason: execErr.message });
        policyEngine.recordTransactionResult(mandate.agent_id, false);
      }
    } else if (evaluation.decision === 'held_for_review') {
      mandate = updateMandateStatus(mandate, 'held_for_review', { reason: evaluation.breachReason });
    } else {
      mandate = updateMandateStatus(mandate, 'rejected', { reason: evaluation.breachReason });
      policyEngine.recordTransactionResult(mandate.agent_id, false);
    }
  }

  // Deduplicate and update mandate history
  const existingIdx = recentMandates.findIndex(m => m.mandate_id === mandate.mandate_id);
  if (existingIdx >= 0) {
    recentMandates[existingIdx] = mandate;
  } else {
    recentMandates.unshift(mandate);
  }
  if (recentMandates.length > 100) recentMandates.pop();

  broadcast('MANDATE_UPDATED', { mandate, evaluation });

  // 5. Reasoning Narrator
  const agentStateAfter = policyEngine.getAgentState(mandate.agent_id);
  const narrative = await reasoningNarrator.explainDecision({
    mandate,
    evaluation,
    killCheck,
    originProtocolName: adapter.name,
    agentState: agentStateAfter
  });

  const narrationRecord = {
    mandate_id: mandate.mandate_id,
    agent_id: mandate.agent_id,
    decision: mandate.status,
    text: narrative,
    timestamp: new Date().toISOString()
  };

  const existNarrIdx = recentNarrations.findIndex(n => n.mandate_id === mandate.mandate_id);
  if (existNarrIdx >= 0) {
    recentNarrations[existNarrIdx] = narrationRecord;
  } else {
    recentNarrations.unshift(narrationRecord);
  }
  if (recentNarrations.length > 100) recentNarrations.pop();

  broadcast('NARRATION_READY', narrationRecord);

  const protocolResponse = adapter.formatResponse(mandate, executionResult);

  return {
    mandate,
    evaluation,
    executionResult,
    narrative,
    protocolResponse
  };
}

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    merchant: {
      merchant_id: 'kirana_test_04',
      name: 'Sharma Daily Mart & Kirana',
      currency: 'INR'
    },
    adapters: adapterRegistry.listAdapters(),
    policies: TIER_POLICIES
  });
});

app.get('/api/adapters', (req, res) => {
  res.json(adapterRegistry.listAdapters());
});

app.get('/api/audit', (req, res) => {
  res.json({
    mandates: recentMandates,
    narrations: recentNarrations,
    policyLogs: policyEngine.getAuditLog(50),
    killEvents: killSwitch.getKillEvents(20)
  });
});

app.post('/api/process', async (req, res) => {
  try {
    const { protocolId, payload } = req.body;
    if (!protocolId || !payload) {
      return res.status(400).json({ error: 'Missing protocolId or payload' });
    }
    const result = await processGatewayTransaction(protocolId, payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingest', async (req, res) => {
  try {
    const { specText } = req.body;
    if (!specText) {
      return res.status(400).json({ error: 'Missing specText' });
    }

    const onProgress = (prog) => {
      broadcast('INGESTION_PROGRESS', prog);
    };

    const result = await protocolIngestionAgent.ingestProtocol(specText, onProgress);
    
    broadcast('ADAPTER_REGISTERED', {
      adapter: adapterRegistry.getAdapter(result.protocolId),
      adaptersList: adapterRegistry.listAdapters()
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Counter to drive realistic variance and progressive trust
let scenarioRunCounter = 0;

// Persistent Returning Buyer Agent for progressive trust demonstration
const RETURNING_ACP_AGENT = 'urn:agent:google:acp:procure_bot_main';
const RETURNING_AP2_AGENT = 'did:npci:uap:in:retail_restock_lead';

app.post('/api/scenario/:name', async (req, res) => {
  const { name } = req.params;
  scenarioRunCounter++;
  const runId = scenarioRunCounter;

  try {
    if (name === 'acp_normal') {
      // Progressive trust: uses persistent returning agent so its trust tier visibly elevates over runs!
      const currentAgentState = policyEngine.getAgentState(RETURNING_ACP_AGENT);
      const currentTier = currentAgentState.trust_tier;
      const cap = TIER_POLICIES[currentTier]?.max_auto_approve_amount || 1000;

      // Select dynamic items fitting inside the current tier ceiling
      const qty1 = (runId % 2) + 1;
      const qty2 = 1;
      const item1 = INVENTORY_CATALOG[1]; // Atta
      const item2 = INVENTORY_CATALOG[3 + (runId % 3)]; // Varied spice/ghee

      const cart = [
        { item_sku: item1.sku, quantity: qty1, price_inr: item1.base_price + (runId * 5 % 30) },
        { item_sku: item2.sku, quantity: qty2, price_inr: item2.base_price }
      ];
      let total = cart.reduce((sum, i) => sum + (i.price_inr * i.quantity), 0);
      if (total > cap) total = cap - 60; // ensure fits within progressive ceiling

      const payload = {
        acp_version: '2026.1',
        buyer_agent: {
          agent_urn: RETURNING_ACP_AGENT,
          trust_level: currentTier
        },
        order_intent: {
          cart,
          currency: 'INR',
          declared_total: total
        },
        auth_token: `acp_sig_${crypto.randomUUID().slice(0, 10)}`
      };

      const result = await processGatewayTransaction('acp', payload);
      return res.json({ scenario: name, result });
    }

    if (name === 'ap2_normal') {
      const currentAgentState = policyEngine.getAgentState(RETURNING_AP2_AGENT);
      const currentTier = currentAgentState.trust_tier;

      // Realistic AP2 Restock Lines with dynamic variance
      const itemA = INVENTORY_CATALOG[7]; // Mustard oil
      const itemB = INVENTORY_CATALOG[8 + (runId % 3)]; // Varied dal/tea
      const countA = (runId % 2) + 1;
      const countB = 1;
      const rateA = itemA.base_price + (runId * 10 % 50);
      const rateB = itemB.base_price;
      const grossVal = (countA * rateA) + (countB * rateB);

      const payload = {
        uap_envelope: '1.2',
        payer_agent: {
          vpa: `b2b.restock.lead@axisbank`,
          agent_did: RETURNING_AP2_AGENT
        },
        transaction_request: {
          line_items: [
            { prod_code: itemA.sku, count: countA, rate: rateA },
            { prod_code: itemB.sku, count: countB, rate: rateB }
          ],
          gross_val: grossVal,
          denomination: 'INR'
        },
        digital_token: `npci_sig_${crypto.randomUUID().slice(0, 10)}`
      };

      const result = await processGatewayTransaction('ap2', payload);
      return res.json({ scenario: name, result });
    }

    if (name === 'ingest_x402') {
      const specPath = path.resolve(__dirname, '../../protocols/x402_spec.md');
      let specContent = '';
      try {
        specContent = fs.readFileSync(specPath, 'utf8');
      } catch (e) {
        specContent = `# x402 Protocol Specification\nProtocol: x402\nVersion: 1.0.4\nSupports HTTP-native 402 payment headers for autonomous buyer agents.`;
      }

      const ingestionResult = await protocolIngestionAgent.ingestProtocol(specContent, (p) => {
        broadcast('INGESTION_PROGRESS', p);
      });

      broadcast('ADAPTER_REGISTERED', {
        adapter: adapterRegistry.getAdapter('x402'),
        adaptersList: adapterRegistry.listAdapters()
      });

      await new Promise(r => setTimeout(r, 1200));

      const x402AgentId = `did:agent:x402:autonomous_buyer_${runId + 400}`;
      const units1 = 1 + (runId % 2);
      const units2 = 1;
      const price1 = 540 + ((runId * 15) % 45);
      const price2 = 620;
      const settlement = (units1 * price1) + (units2 * price2);

      const payload = {
        x_protocol: 'x402-v1',
        headers: {
          x_agent_id: x402AgentId,
          x_auth_proof: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
        },
        body: {
          purchase_orders: [
            { item_id: 'SKU_INDIA_GATE_CLASSIC_10KG', units: units1, price_per_unit: price1 },
            { item_id: 'SKU_AMUL_COW_GHEE_1L', units: units2, price_per_unit: price2 }
          ],
          settlement_amount: settlement,
          currency: 'INR',
          callback_url: 'https://agent.x402.network/settle'
        }
      };

      policyEngine.setAgentTrustTier(x402AgentId, 2);
      const txResult = await processGatewayTransaction('x402', payload);

      return res.json({
        scenario: name,
        ingestion: ingestionResult,
        transaction: txResult
      });
    }

    if (name === 'policy_breach') {
      const unverifiedAgentId = `urn:agent:google:acp:procure_bot_unverified_${runId + 10}`;
      const breachAmounts = [4200, 4650, 5100, 3950];
      const chosenAmount = breachAmounts[runId % breachAmounts.length];
      const qty = 7;
      const unitPrice = Math.round(chosenAmount / qty);

      const payload = {
        acp_version: '2026.1',
        buyer_agent: {
          agent_urn: unverifiedAgentId,
          trust_level: 1
        },
        order_intent: {
          cart: [
            { item_sku: 'SKU_EVEREST_GARAM_MASALA_1KG', quantity: qty, price_inr: unitPrice }
          ],
          currency: 'INR',
          declared_total: chosenAmount
        },
        auth_token: `acp_sig_breach_${crypto.randomUUID().slice(0, 8)}`
      };

      policyEngine.setAgentTrustTier(unverifiedAgentId, 1);
      const result = await processGatewayTransaction('acp', payload);
      return res.json({ scenario: name, result });
    }

    if (name === 'burst_attack') {
      const rogueAgentId = `urn:agent:rogue_highfreq_bot_${runId + 20}`;
      policyEngine.unfreezeAgent(rogueAgentId);
      
      // Dynamic realistic high-value inventory items for burst sequence
      const burstCatalog = [
        INVENTORY_CATALOG[11], // Cashew 5kg
        INVENTORY_CATALOG[12], // Almonds 10kg
        INVENTORY_CATALOG[13], // Saffron 50g
        INVENTORY_CATALOG[14]  // Pista 5kg
      ];

      const results = [];
      for (let i = 0; i < 4; i++) {
        const item = burstCatalog[i];
        const dynamicPrice = item.base_price + ((runId * 40 + i * 150) % 500);
        const payload = {
          acp_version: '2026.1',
          buyer_agent: { agent_urn: rogueAgentId },
          order_intent: {
            cart: [{ item_sku: item.sku, quantity: 1, price_inr: dynamicPrice }],
            currency: 'INR',
            declared_total: dynamicPrice
          }
        };
        const resTx = await processGatewayTransaction('acp', payload);
        results.push(resTx);
        await new Promise(r => setTimeout(r, 120)); // Rapid burst within 500ms
      }
      return res.json({ scenario: name, results });
    }

    if (name === 'reset_state') {
      recentMandates.length = 0;
      recentNarrations.length = 0;
      policyEngine.policyAuditLog.length = 0;
      killSwitch.killEvents.length = 0;
      killSwitch.agentHistory.clear();
      policyEngine.agentStates.clear();
      
      // Reset returning agents
      policyEngine.setAgentTrustTier(RETURNING_ACP_AGENT, 1);
      policyEngine.setAgentTrustTier(RETURNING_AP2_AGENT, 1);

      broadcast('STATE_RESET', {});
      return res.json({ status: 'reset_successful' });
    }

    res.status(404).json({ error: `Unknown scenario: ${name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Bridge Gateway] Server listening on http://localhost:${PORT}`);
  console.log(`[Bridge Gateway] WebSocket server active on ws://localhost:${PORT}`);
});
