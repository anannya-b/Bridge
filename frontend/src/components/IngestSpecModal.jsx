import React, { useState } from 'react';

const SAMPLE_SPEC_PRESETS = {
  x402: `# x402 Protocol Specification (HTTP-Native Agent Payment Handshake)
Protocol: x402
Version: 1.0.4

Request Envelope:
{
  "x_protocol": "x402-v1",
  "headers": {
    "x_agent_id": "did:agent:x402:autonomous_buyer_402",
    "x_auth_proof": "0x8892fbc9471182309aaee"
  },
  "body": {
    "purchase_orders": [
      { "item_id": "SKU_INDIA_GATE_CLASSIC_10KG", "units": 2, "price_per_unit": 540 },
      { "item_id": "SKU_AMUL_COW_GHEE_1L", "units": 1, "price_per_unit": 620 }
    ],
    "settlement_amount": 1700,
    "currency": "INR",
    "callback_url": "https://agent.x402.network/settle"
  }
}`,
  uap_ext: `# NPCI UAP-Extended Agent Restock Protocol
Protocol: uap_ext
Version: 2.0

Request Structure:
{
  "envelope": "uap-v2",
  "agent_identity": { "did": "did:npci:v2:agent_dairy_restock_41" },
  "payload": {
    "items": [
      { "sku": "SKU_FORTUNE_SUNFLOWER_15L", "quantity": 2, "unit_cost": 1850 }
    ],
    "total_gross": 3700,
    "currency": "INR"
  }
}`
};

export function IngestSpecModal({ isOpen, onClose, onIngest, isIngesting }) {
  const [specText, setSpecText] = useState(SAMPLE_SPEC_PRESETS.x402);
  const [selectedPreset, setSelectedPreset] = useState('x402');

  if (!isOpen) return null;

  const handlePresetChange = (key) => {
    setSelectedPreset(key);
    setSpecText(SAMPLE_SPEC_PRESETS[key] || '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onIngest(specText);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ width: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>AI Protocol Ingestion Agent (Live Adapter Synthesis)</span>
          <button className="close-btn" onClick={onClose}>[ESC / CLOSE]</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div style={{ marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: 'var(--chrome)', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>LOAD SPEC PRESET:</span>
            <button
              type="button"
              className="scenario-btn"
              style={{ fontSize: '10.5px', borderColor: selectedPreset === 'x402' ? 'var(--chrome)' : 'var(--chrome-dim)' }}
              onClick={() => handlePresetChange('x402')}
            >
              x402 HTTP Handshake
            </button>
            <button
              type="button"
              className="scenario-btn"
              style={{ fontSize: '10.5px', borderColor: selectedPreset === 'uap_ext' ? 'var(--chrome)' : 'var(--chrome-dim)' }}
              onClick={() => handlePresetChange('uap_ext')}
            >
              NPCI UAP-Ext Restock
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: 'var(--chrome)', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>
              RAW PROTOCOL SPECIFICATION (Markdown, Schema, or OpenAPI docs):
            </span>
            <textarea
              value={specText}
              onChange={e => setSpecText(e.target.value)}
              rows={12}
              style={{
                width: '100%',
                backgroundColor: 'var(--chrome-dark)',
                color: 'var(--text-primary)',
                border: '1px solid var(--chrome-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '10px',
                marginTop: '6px',
                outline: 'none',
                resize: 'vertical'
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--chrome)', fontSize: '10.5px', fontFamily: 'var(--font-sans)' }}>
              Ingestion Agent will parse schemas, generate adapter code, compile AST, and register dynamic route.
            </span>

            <button
              type="submit"
              className="scenario-btn primary"
              disabled={isIngesting || !specText.trim()}
              style={{ padding: '8px 16px', fontWeight: '600' }}
            >
              {isIngesting ? 'Synthesizing Adapter...' : 'Synthesize & Register Adapter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
