/**
 * Deterministic Validator for Dynamic Adapter Field Mappings
 *
 * Runs after protocol-ingestion agent generates a field-mapping proposal
 * and before that adapter is marked active.
 *
 * Checks:
 * (a) amount field maps to a numeric type
 * (b) currency field is present and non-null
 * (c) agent_id field is present
 * (d) no required canonical field is unmapped (agent_id, origin_protocol, merchant_id, items, total_amount, currency)
 *
 * @param {object} proposal - Field-mapping proposal and normalized sample
 * @returns {{ isValid: boolean, passedFieldsCount: number, failedFields: string[], details: object }}
 */
export function validateAdapterMapping(proposal) {
  const failedFields = [];
  let passedFieldsCount = 0;
  const details = {};

  if (!proposal || typeof proposal !== 'object') {
    return {
      isValid: false,
      passedFieldsCount: 0,
      failedFields: ['proposal_missing'],
      details: { error: 'Proposal must be a non-null object' }
    };
  }

  const sample = proposal.sampleNormalized || {};
  const mappings = proposal.fieldMappings || {};

  // Check (a): amount field maps to a numeric type
  const isAmountValid = 
    sample.total_amount !== undefined && 
    sample.total_amount !== null && 
    typeof sample.total_amount === 'number' && 
    !isNaN(sample.total_amount) && 
    isFinite(sample.total_amount) && 
    sample.total_amount >= 0;

  if (isAmountValid) {
    passedFieldsCount++;
    details.amount = {
      status: 'PASSED',
      mappedTo: mappings.total_amount || 'total_amount',
      value: sample.total_amount,
      type: typeof sample.total_amount
    };
  } else {
    failedFields.push('amount');
    details.amount = {
      status: 'FAILED',
      mappedTo: mappings.total_amount || null,
      value: sample.total_amount,
      type: typeof sample.total_amount,
      error: 'amount field must map to a valid non-negative numeric type'
    };
  }

  // Check (b): currency field is present and non-null
  const isCurrencyValid = 
    sample.currency !== undefined && 
    sample.currency !== null && 
    typeof sample.currency === 'string' && 
    sample.currency.trim().length > 0;

  if (isCurrencyValid) {
    passedFieldsCount++;
    details.currency = {
      status: 'PASSED',
      mappedTo: mappings.currency || 'currency',
      value: sample.currency
    };
  } else {
    failedFields.push('currency');
    details.currency = {
      status: 'FAILED',
      mappedTo: mappings.currency || null,
      value: sample.currency,
      error: 'currency field must be present and non-null non-empty string'
    };
  }

  // Check (c): agent_id field is present
  const isAgentIdValid = 
    sample.agent_id !== undefined && 
    sample.agent_id !== null && 
    typeof sample.agent_id === 'string' && 
    sample.agent_id.trim().length > 0;

  if (isAgentIdValid) {
    passedFieldsCount++;
    details.agent_id = {
      status: 'PASSED',
      mappedTo: mappings.agent_id || 'agent_id',
      value: sample.agent_id
    };
  } else {
    failedFields.push('agent_id');
    details.agent_id = {
      status: 'FAILED',
      mappedTo: mappings.agent_id || null,
      value: sample.agent_id,
      error: 'agent_id field is missing or empty'
    };
  }

  // Check (d): no required canonical field is unmapped
  const requiredCanonicalFields = [
    'agent_id',
    'origin_protocol',
    'merchant_id',
    'items',
    'total_amount',
    'currency'
  ];

  const unmappedFields = [];
  for (const field of requiredCanonicalFields) {
    const val = sample[field];
    const isPresent = val !== undefined && val !== null;
    if (!isPresent) {
      unmappedFields.push(field);
    }
  }

  if (unmappedFields.length === 0) {
    passedFieldsCount++;
    details.required_canonical_fields = {
      status: 'PASSED',
      checkedFields: requiredCanonicalFields
    };
  } else {
    failedFields.push(`unmapped_canonical_fields: [${unmappedFields.join(', ')}]`);
    details.required_canonical_fields = {
      status: 'FAILED',
      unmappedFields
    };
  }

  const isValid = failedFields.length === 0;

  return {
    isValid,
    passedFieldsCount,
    failedFields,
    details
  };
}
