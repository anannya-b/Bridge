import React from 'react';

export function ProtocolLanes({ adapters, ingestionProgress, onSelectAdapter }) {
  // Ensure we show at least ACP, AP2, and x402
  const knownProtocols = [
    { id: 'acp', name: 'Google ACP', version: '2026.1' },
    { id: 'ap2', name: 'NPCI UAP / AP2', version: '1.2' },
    { id: 'x402', name: 'x402 HTTP-Native', version: '1.0.4' }
  ];

  const registeredMap = new Map(adapters.map(a => [a.protocolId.toLowerCase(), a]));

  return (
    <div className="bottom-strip">
      <div className="lanes-container">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--chrome)' }}>
          PROTOCOL LANES:
        </span>

        {knownProtocols.map(proto => {
          const isRegistered = registeredMap.has(proto.id);
          const registeredInfo = registeredMap.get(proto.id);
          const isIngestingThis = ingestionProgress && ingestionProgress.progress < 100 && proto.id === 'x402' && !isRegistered;

          let statusClass = isRegistered ? 'active' : (isIngestingThis ? 'ingesting' : 'idle');

          return (
            <div 
              key={proto.id} 
              className={`lane-item ${statusClass}`}
              onClick={() => isRegistered && onSelectAdapter(registeredInfo)}
              style={{ cursor: isRegistered ? 'pointer' : 'default' }}
            >
              <span className={`lane-dot ${statusClass}`}></span>
              <span>{proto.id.toUpperCase()} · {proto.name}</span>
              
              {isIngestingThis && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--chrome)', marginLeft: '4px' }}>
                    ingesting {ingestionProgress.progress}%...
                  </span>
                  <div className="ingest-progress-bar">
                    <div 
                      className="ingest-progress-fill" 
                      style={{ width: `${ingestionProgress.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {isRegistered && registeredInfo.isDynamic && (
                <span style={{ fontSize: '9.5px', color: 'var(--approve)', border: '1px solid var(--approve-dim)', padding: '0 4px', borderRadius: '2px' }}>
                  AI Ingested
                </span>
              )}
            </div>
          );
        })}

        {/* Any extra custom protocols ingested */}
        {adapters.filter(a => !['acp', 'ap2', 'x402'].includes(a.protocolId.toLowerCase())).map(a => (
          <div 
            key={a.protocolId} 
            className="lane-item active"
            onClick={() => onSelectAdapter(a)}
            style={{ cursor: 'pointer' }}
          >
            <span className="lane-dot active"></span>
            <span>{a.protocolId.toUpperCase()} · {a.name}</span>
            <span style={{ fontSize: '9.5px', color: 'var(--approve)', border: '1px solid var(--approve-dim)', padding: '0 4px', borderRadius: '2px' }}>
              Custom
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--chrome)' }}>
        POLICY ENGINE: <span style={{ color: 'var(--approve)' }}>ACTIVE</span> | CIRCUIT BREAKER: <span style={{ color: 'var(--approve)' }}>ARMED</span>
      </div>
    </div>
  );
}
