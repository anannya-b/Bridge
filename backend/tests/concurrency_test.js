import crypto from 'crypto';

const SERVER_URL = process.env.BRIDGE_SERVER_URL || 'http://localhost:3001';

async function runConcurrencyTest() {
  console.log('\n===============================================================');
  console.log('BRIDGE CONCURRENCY STRESS TEST (10 SIMULTANEOUS IDENTICAL MANDATES)');
  console.log('===============================================================\n');

  // Generate a single unique mandate_id to be replayed simultaneously by 10 requests
  const sharedMandateId = `man_concurrent_${crypto.randomUUID().slice(0, 12)}`;
  console.log(`Target Shared Mandate ID: ${sharedMandateId}`);
  console.log(`Target Endpoint: ${SERVER_URL}/api/process`);
  console.log(`Firing 10 simultaneous requests via Promise.all()...\n`);

  const payload = {
    protocolId: 'acp',
    mandate_id: sharedMandateId,
    payload: {
      acp_version: '2026.1',
      buyer_agent: {
        agent_urn: 'urn:agent:google:acp:concurrency_stress_bot',
        trust_level: 2
      },
      order_intent: {
        cart: [
          { item_sku: 'SKU_AASHIRVAAD_ATTA_10KG', quantity: 2, price_inr: 430 }
        ],
        currency: 'INR',
        declared_total: 860
      },
      auth_token: `acp_sig_${crypto.randomUUID().slice(0, 8)}`
    }
  };

  // Launch 10 simultaneous requests using Promise.all
  const startTime = Date.now();
  const requestPromises = Array.from({ length: 10 }, (_, index) => {
    const requestId = index + 1;
    return fetch(`${SERVER_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const json = await res.json();
        return {
          requestIndex: requestId,
          httpStatus: res.status,
          mandateId: json.mandate?.mandate_id || sharedMandateId,
          mandateStatus: json.mandate?.status || 'ERROR',
          razorpayOrderId: json.executionResult?.orderId || json.mandate?.razorpay_order_id || 'N/A',
          decision: json.evaluation?.decision || 'N/A',
          isSuccessful: json.mandate?.status === 'executed' || json.mandate?.status === 'approved',
          isDuplicateRejected: json.mandate?.status === 'DUPLICATE_REJECTED'
        };
      })
      .catch((err) => {
        return {
          requestIndex: requestId,
          httpStatus: 500,
          mandateId: sharedMandateId,
          mandateStatus: 'NETWORK_ERROR',
          razorpayOrderId: 'N/A',
          decision: 'ERROR',
          isSuccessful: false,
          isDuplicateRejected: false,
          error: err.message
        };
      });
  });

  const results = await Promise.all(requestPromises);
  const durationMs = Date.now() - startTime;

  // Format table for console output
  const summaryTable = results.map(r => ({
    'Req #': `Req #${r.requestIndex}`,
    'Mandate ID': r.mandateId,
    'HTTP': r.httpStatus,
    'Mandate Status': r.mandateStatus,
    'Razorpay Order': r.razorpayOrderId,
    'Outcome': r.isSuccessful ? 'SUCCESS (1st WINNER)' : (r.isDuplicateRejected ? 'DUPLICATE_REJECTED' : 'FAILED')
  }));

  console.table(summaryTable);

  const successCount = results.filter(r => r.isSuccessful).length;
  const duplicateRejectedCount = results.filter(r => r.isDuplicateRejected).length;
  const errorCount = results.filter(r => !r.isSuccessful && !r.isDuplicateRejected).length;

  console.log('\n---------------------------------------------------------------');
  console.log(`Execution Time: ${durationMs}ms`);
  console.log(`Total Requests Fired: ${results.length}`);
  console.log(`Successful Executions: ${successCount}`);
  console.log(`Duplicate Rejections: ${duplicateRejectedCount}`);
  console.log(`Other Errors: ${errorCount}`);
  console.log('---------------------------------------------------------------\n');

  // Assertions
  let testFailed = false;

  if (successCount === 1) {
    console.log('✓ PASS: Exactly 1 request succeeded and settled against Razorpay.');
  } else {
    console.error(`✗ FAIL: Expected exactly 1 success, but got ${successCount}`);
    testFailed = true;
  }

  if (duplicateRejectedCount === 9) {
    console.log('✓ PASS: Exactly 9 requests were caught by atomic unique constraint and returned DUPLICATE_REJECTED.');
  } else {
    console.error(`✗ FAIL: Expected exactly 9 DUPLICATE_REJECTED, but got ${duplicateRejectedCount}`);
    testFailed = true;
  }

  if (errorCount === 0) {
    console.log('✓ PASS: Zero unhandled crashes or internal 500 errors.');
  } else {
    console.error(`✗ FAIL: ${errorCount} requests encountered unexpected errors.`);
    testFailed = true;
  }

  console.log('\n===============================================================');
  if (!testFailed) {
    console.log('CONCURRENCY TEST RESULT: ALL ASSERTIONS PASSED (10/10 RESOLVED)');
    console.log('===============================================================\n');
    process.exit(0);
  } else {
    console.error('CONCURRENCY TEST RESULT: FAILED ASSERTIONS');
    console.log('===============================================================\n');
    process.exit(1);
  }
}

runConcurrencyTest().catch(err => {
  console.error('Fatal concurrency runner error:', err);
  process.exit(1);
});
