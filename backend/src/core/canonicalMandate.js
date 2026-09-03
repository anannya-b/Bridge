import crypto from 'crypto';

const MERCHANT_SIGNING_SECRET = process.env.BRIDGE_SECRET || 'bridge_hmac_secret_key_kirana_04_2026';

/**
 * Creates a signed Canonical Mandate
 */
export function createCanonicalMandate({
  mandate_id = `man_${crypto.randomUUID().slice(0, 12)}`,
  agent_id,
  origin_protocol,
  merchant_id = 'kirana_test_04',
  items = [],
  total_amount,
  currency = 'INR',
  agent_trust_tier = 1,
  spend_cap_checked_against = 1000,
  status = 'pending',
  created_at = new Date().toISOString(),
  expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  metadata = {}
}) {
  if (!agent_id) throw new Error('Mandate requires agent_id');
  if (!origin_protocol) throw new Error('Mandate requires origin_protocol');
  if (total_amount === undefined || total_amount === null) {
    total_amount = items.reduce((sum, item) => sum + (item.unit_price * (item.qty || 1)), 0);
  }

  const payloadToSign = {
    mandate_id,
    agent_id,
    origin_protocol,
    merchant_id,
    items,
    total_amount: Number(total_amount),
    currency,
    spend_cap_checked_against: Number(spend_cap_checked_against),
    agent_trust_tier: Number(agent_trust_tier),
    status,
    created_at,
    expires_at
  };

  const signature = signMandatePayload(payloadToSign);

  return {
    ...payloadToSign,
    signature,
    metadata
  };
}

/**
 * Signs the core fields using HMAC-SHA256
 */
export function signMandatePayload(payload) {
  const normalizedString = [
    payload.mandate_id,
    payload.agent_id,
    payload.origin_protocol,
    payload.merchant_id,
    payload.total_amount,
    payload.currency,
    payload.agent_trust_tier,
    payload.status,
    payload.created_at,
    payload.expires_at
  ].join('|');

  return crypto
    .createHmac('sha256', MERCHANT_SIGNING_SECRET)
    .update(normalizedString)
    .digest('hex');
}

/**
 * Verifies mandate signature & expiry integrity
 */
export function verifyCanonicalMandate(mandate) {
  if (!mandate || !mandate.signature) {
    return { valid: false, reason: 'Missing signature' };
  }

  const expectedSignature = signMandatePayload(mandate);
  if (expectedSignature !== mandate.signature) {
    return { valid: false, reason: 'Invalid cryptographic signature (tampered mandate)' };
  }

  const now = new Date();
  if (new Date(mandate.expires_at) < now) {
    return { valid: false, reason: 'Mandate has expired' };
  }

  return { valid: true };
}

/**
 * Updates mandate status and resigns it
 */
export function updateMandateStatus(mandate, newStatus, extraUpdates = {}) {
  const updated = {
    ...mandate,
    ...extraUpdates,
    status: newStatus
  };
  delete updated.signature;
  const signature = signMandatePayload(updated);
  return {
    ...updated,
    signature
  };
}
