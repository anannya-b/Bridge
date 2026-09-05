import React from 'react';

export function ProtocolLanes({ adapters, ingestionProgress, onSelectAdapter }) {
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

          const isPendingValidation = isRegistered && (registeredInfo.status === 'PENDING_VALIDATION' || registeredInfo.status === 'pending_validation');
          const isActive = isRegistered && (registeredInfo.status === 'active' || registeredInfo.status === 'ACTIVE');

          let statusClass = isActive ? 'active' : (isPendingValidation ? 'pending-validation' : (isIngestingThis ? 'ingesting' : 'idle'));

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

              {isPendingValidation && (
                <span style={{ fontSize: '9.5px', color: 'var(--passive-breach)', border: '1px solid var(--passive-breach-dim)', padding: '0 4px', borderRadius: '2px', backgroundColor: 'var(--chrome-dark)' }}>
                  PENDING_VALIDATION
                </span>
              )}

              {isActive && registeredInfo.isDynamic && (
                <span style={{ fontSize: '9.5px', color: 'var(--approve)', border: '1px solid var(--approve-dim)', padding: '0 4px', borderRadius: '2px' }}>
                  AI Ingested
                </span>
              )}
            </div>
          );
        })}

        {/* Extra custom protocols ingested */}
        {adapters.filter(a => !['acp', 'ap2', 'x402'].includes(a.protocolId.toLowerCase())).map(a => {
          const isPending = a.status === 'PENDING_VALIDATION' || a.status === 'pending_validation';
          const isActive = a.status === 'active' || a.status === 'ACTIVE';
          const statusClass = isActive ? 'active' : (isPending ? 'pending-validation' : 'idle');

          return (
            <div 
              key={a.protocolId} 
              className={`lane-item ${statusClass}`}
              onClick={() => onSelectAdapter(a)}
              style={{ cursor: 'pointer' }}
            >
              <span className={`lane-dot ${statusClass}`}></span>
              <span>{a.protocolId.toUpperCase()} · {a.name}</span>
              {isPending ? (
                <span style={{ fontSize: '9.5px', color: 'var(--passive-breach)', border: '1px solid var(--passive-breach-dim)', padding: '0 4px', borderRadius: '2px' }}>
                  PENDING_VALIDATION
                </span>
              ) : (
                <span style={{ fontSize: '9.5px', color: 'var(--approve)', border: '1px solid var(--approve-dim)', padding: '0 4px', borderRadius: '2px' }}>
                  Custom
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--chrome)' }}>
        POLICY ENGINE: <span style={{ color: 'var(--approve)' }}>ACTIVE</span> | CIRCUIT BREAKER: <span style={{ color: 'var(--approve)' }}>ARMED</span>
      </div>
    </div>
  );
}
