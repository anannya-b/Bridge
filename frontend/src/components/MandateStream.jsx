import React, { useMemo } from 'react';

export function MandateStream({ mandates, selectedMandate, onSelectMandate, killSwitchTriggeredId }) {
  // Guarantee absolute deduplication by mandate_id
  const uniqueMandates = useMemo(() => {
    const map = new Map();
    for (const m of mandates) {
      if (m && m.mandate_id && !map.has(m.mandate_id)) {
        map.set(m.mandate_id, m);
      }
    }
    return Array.from(map.values());
  }, [mandates]);

  return (
    <div className="mandate-stream-panel">
      <div className="panel-header-mono">
        <span>LIVE CANONICAL MANDATE STREAM (HMAC-SHA256)</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{uniqueMandates.length} MANDATES</span>
      </div>

      <div className="stream-table-header">
        <span>TIME</span>
        <span>AGENT IDENTITY</span>
        <span>PROTOCOL</span>
        <span>AMOUNT (INR)</span>
        <span>TIER</span>
        <span>STATUS</span>
      </div>

      <div className="stream-rows-container">
        {uniqueMandates.length === 0 ? (
          <div style={{ padding: '36px 16px', color: 'var(--chrome)', textAlign: 'center', fontSize: '11px' }}>
            Awaiting incoming buyer-agent requests. Select a scenario from the top flight deck...
          </div>
        ) : (
          uniqueMandates.map((m) => {
            const isKillPulse = m.mandate_id === killSwitchTriggeredId || m.status === 'frozen';
            const isSelected = selectedMandate?.mandate_id === m.mandate_id;
            const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '--:--:--';
            
            return (
              <div
                key={m.mandate_id}
                className={`mandate-row ${isSelected ? 'selected' : ''} ${isKillPulse ? 'pulse-kill' : ''}`}
                onClick={() => onSelectMandate(m)}
                title={`Click to inspect signed canonical mandate: ${m.mandate_id}`}
              >
                <span style={{ color: 'var(--chrome)' }}>{timeStr}</span>
                
                <span className="agent-id-truncate" title={m.agent_id}>
                  {m.agent_id}
                </span>

                <div>
                  <span className="protocol-badge">
                    {m.origin_protocol?.toUpperCase()}
                  </span>
                </div>

                <span style={{ fontWeight: '500' }}>
                  ₹{(m.total_amount || 0).toLocaleString()}
                </span>

                <span style={{ color: 'var(--chrome)' }}>
                  T{m.agent_trust_tier || 1}
                </span>

                <div>
                  <span className={`status-dot ${m.status || 'pending'}`}></span>
                  <span className={`status-text ${m.status || 'pending'}`}>
                    {m.status || 'pending'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
