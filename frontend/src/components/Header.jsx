import React from 'react';

export function Header({ merchant, isConnected, globalHalt, onToggleHalt }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <div className="brand-title">
          <span>BRIDGE</span>
        </div>
        <div className="brand-subtitle">
          Universal Translation & Trust Layer
        </div>
        <div className="merchant-badge">
          merchant: {merchant?.merchant_id || 'kirana_test_04'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--chrome)' }}>
          settlement: <span style={{ color: 'var(--approve)' }}>RAZORPAY_TEST_MODE</span>
        </div>
      </div>

      <div className="header-right">
        <button 
          className={`halt-btn ${globalHalt ? 'active' : ''}`}
          onClick={onToggleHalt}
          title="Emergency Master Circuit Breaker for all Agentic Transactions"
        >
          {globalHalt ? 'EMERGENCY HALT ENGAGED' : 'Emergency Master Halt'}
        </button>

        <div className="live-indicator">
          <span className="live-dot" style={{ backgroundColor: isConnected ? 'var(--approve)' : 'var(--passive-breach)' }}></span>
          <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
}
