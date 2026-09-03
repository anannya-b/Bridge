import { createCanonicalMandate, verifyCanonicalMandate, updateMandateStatus } from '../src/core/canonicalMandate.js';
import { AcpAdapter } from '../src/adapters/acpAdapter.js';
import { Ap2Adapter } from '../src/adapters/ap2Adapter.js';
import { adapterRegistry } from '../src/adapters/adapterRegistry.js';
import { protocolIngestionAgent } from '../src/ingestion/protocolIngestionAgent.js';
import { policyEngine } from '../src/policy/policyEngine.js';
import { killSwitch } from '../src/policy/killSwitch.js';
import { razorpayClient } from '../src/execution/razorpayClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== RUNNING BRIDGE CORE UNIT & INTEGRATION TESTS ===\n');

  // Test 1: Canonical Mandate creation and cryptographic verification
  console.log('[Test Suite 1] Canonical Mandate & Cryptography');
  const mandate1 = createCanonicalMandate({
    agent_id: 'urn:agent:google:acp:test_buyer_1',
    origin_protocol: 'acp',
    items: [{ sku: 'SKU_1', qty: 2, unit_price: 100 }],
    total_amount: 200,
    currency: 'INR'
  });

  assert(mandate1.mandate_id.startsWith('man_'), 'Generates valid mandate_id');
  assert(mandate1.signature && mandate1.signature.length === 64, 'Signs mandate with SHA256 HMAC');
  assert(verifyCanonicalMandate(mandate1).valid === true, 'Validates untampered mandate signature');

  // Tamper check
  const tamperedMandate = { ...mandate1, total_amount: 99999 };
  assert(verifyCanonicalMandate(tamperedMandate).valid === false, 'Detects tampered mandate amount');

  // Test 2: ACP & AP2 Adapters
  console.log('\n[Test Suite 2] Hardcoded Protocol Adapters');
  const acpAdapter = new AcpAdapter();
  const acpRaw = {
    acp_version: '2026.1',
    buyer_agent: { agent_urn: 'urn:agent:acp:bot' },
    order_intent: {
      cart: [{ item_sku: 'RICE', quantity: 2, price_inr: 250 }],
      currency: 'INR',
      declared_total: 500
    }
  };
  const acpNorm = acpAdapter.normalize(acpRaw);
  assert(acpNorm.agent_id === 'urn:agent:acp:bot', 'ACP adapter extracts buyer agent');
  assert(acpNorm.total_amount === 500, 'ACP adapter extracts total amount');
  assert(acpNorm.items.length === 1 && acpNorm.items[0].sku === 'RICE', 'ACP adapter extracts cart items');

  const ap2Adapter = new Ap2Adapter();
  const ap2Raw = {
    uap_envelope: '1.2',
    payer_agent: { agent_did: 'did:npci:uap:test' },
    transaction_request: {
      line_items: [{ prod_code: 'WHEAT', count: 1, rate: 300 }],
      gross_val: 300,
      denomination: 'INR'
    }
  };
  const ap2Norm = ap2Adapter.normalize(ap2Raw);
  assert(ap2Norm.agent_id === 'did:npci:uap:test', 'AP2 adapter extracts agent did');
  assert(ap2Norm.total_amount === 300, 'AP2 adapter extracts gross value');

  // Test 3: Live Protocol Ingestion Agent
  console.log('\n[Test Suite 3] Live Protocol Ingestion Agent');
  const specPath = path.resolve(__dirname, '../../protocols/x402_spec.md');
  const specContent = fs.readFileSync(specPath, 'utf8');

  let progressEvents = [];
  const ingestionResult = await protocolIngestionAgent.ingestProtocol(specContent, (p) => {
    progressEvents.push(p);
  });

  assert(ingestionResult.protocolId === 'x402', 'Ingestion agent correctly identifies protocolId as x402');
  assert(adapterRegistry.getAdapter('x402') !== null, 'Dynamic adapter automatically registered in adapterRegistry');
  assert(progressEvents.length >= 4, 'Progress events streamed across all synthesis phases');

  // Test normalized transaction through newly registered dynamic adapter
  const dynamicAdapter = adapterRegistry.getAdapter('x402');
  const x402Raw = {
    headers: { x_agent_id: 'did:agent:x402:test' },
    body: {
      purchase_orders: [{ item_id: 'SPICE_PACK', units: 3, price_per_unit: 150 }],
      settlement_amount: 450,
      currency: 'INR'
    }
  };
  const x402Norm = dynamicAdapter.normalize(x402Raw);
  assert(x402Norm.agent_id === 'did:agent:x402:test', 'Dynamic x402 adapter normalizes agent ID');
  assert(x402Norm.total_amount === 450, 'Dynamic x402 adapter calculates total amount');

  // Test 4: Policy Engine
  console.log('\n[Test Suite 4] Policy Engine & Progressive Trust Tiers');
  policyEngine.setAgentTrustTier('urn:agent:policy_test', 1); // Tier 1 ceiling = 1000
  
  const okMandate = createCanonicalMandate({
    agent_id: 'urn:agent:policy_test',
    origin_protocol: 'acp',
    total_amount: 800,
    currency: 'INR'
  });
  const okEval = policyEngine.evaluateMandate(okMandate);
  assert(okEval.decision === 'approved', 'Approves transaction within Tier 1 cap (₹800 <= ₹1000)');

  const breachMandate = createCanonicalMandate({
    agent_id: 'urn:agent:policy_test',
    origin_protocol: 'acp',
    total_amount: 4500,
    currency: 'INR'
  });
  const breachEval = policyEngine.evaluateMandate(breachMandate);
  assert(breachEval.decision === 'rejected', 'Rejects transaction breaching Tier 1 cap (₹4500 > ₹1000)');

  // Test 5: Circuit Breaker Kill Switch
  console.log('\n[Test Suite 5] Circuit Breaker Kill Switch');
  const burstAgent = 'urn:agent:burst_test_identity';
  policyEngine.unfreezeAgent(burstAgent);

  let burstCheckResult = { tripped: false };
  for (let i = 0; i < 4; i++) {
    const burstMandate = createCanonicalMandate({
      agent_id: burstAgent,
      origin_protocol: 'acp',
      total_amount: 200,
      currency: 'INR'
    });
    burstCheckResult = killSwitch.check(burstMandate);
  }
  assert(burstCheckResult.tripped === true, 'Circuit breaker trips on rapid burst requests');
  assert(policyEngine.getAgentState(burstAgent).is_frozen === true, 'Agent identity automatically frozen after trip');

  // Test 6: Razorpay Execution
  console.log('\n[Test Suite 6] Razorpay Execution Layer');
  const approvedMandate = createCanonicalMandate({
    agent_id: 'urn:agent:exec_test',
    origin_protocol: 'acp',
    total_amount: 750,
    currency: 'INR',
    status: 'approved'
  });
  const execResult = await razorpayClient.executeMandatePayment(approvedMandate);
  assert(execResult.success === true, 'Executes payment for valid approved mandate');
  assert(execResult.orderId.startsWith('order_'), 'Returns valid Razorpay order ID');
  assert(execResult.paymentId.startsWith('pay_'), 'Returns valid Razorpay payment ID');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
