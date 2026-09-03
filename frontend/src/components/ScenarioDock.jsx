import React from 'react';

export function ScenarioDock({ onRunScenario, loadingScenario, onOpenIngestModal }) {
  return (
    <div className="scenario-dock">
      <span className="scenario-label">Demo Scenarios:</span>

      <button
        className="scenario-btn primary"
        disabled={!!loadingScenario}
        onClick={() => onRunScenario('acp_normal')}
        title="Simulate Google ACP transaction with cart normalization and progressive trust"
      >
        <span>1. Google ACP</span>
      </button>

      <button
        className="scenario-btn primary"
        disabled={!!loadingScenario}
        onClick={() => onRunScenario('ap2_normal')}
        title="Simulate NPCI / AP2 transaction with VPA identification and policy check"
      >
        <span>2. NPCI / AP2</span>
      </button>

      <button
        className="scenario-btn"
        style={{ borderColor: 'var(--chrome)', backgroundColor: 'var(--chrome-dark)' }}
        disabled={!!loadingScenario}
        onClick={() => onRunScenario('ingest_x402')}
        title="Trigger AI Ingestion Agent on unseen x402 specification, live compile adapter & transact"
      >
        <span>3. Ingest x402 Spec</span>
      </button>

      <button
        className="scenario-btn"
        disabled={!!loadingScenario}
        onClick={() => onRunScenario('policy_breach')}
        title="Send transaction exceeding Tier 1 ceiling to trigger explainable rejection"
      >
        <span>4. Policy Breach (4,200 INR)</span>
      </button>

      <button
        className="scenario-btn danger"
        disabled={!!loadingScenario}
        onClick={() => onRunScenario('burst_attack')}
        title="Rapid burst of 4 high-value requests to trip Circuit Breaker Kill Switch"
      >
        <span>5. Trigger Kill Switch</span>
      </button>

      <button
        className="scenario-btn"
        disabled={!!loadingScenario}
        onClick={onOpenIngestModal}
        title="Paste any custom protocol Markdown/OpenAPI spec to live synthesize an adapter"
      >
        <span>+ Ingest Custom Spec</span>
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <button
          className="scenario-btn"
          style={{ fontSize: '10.5px', color: 'var(--chrome)' }}
          disabled={!!loadingScenario}
          onClick={() => onRunScenario('reset_state')}
          title="Clear audit ledger and reset trust states"
        >
          Reset Ledger
        </button>
      </div>
    </div>
  );
}
