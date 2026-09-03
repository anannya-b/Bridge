import React, { useState, useEffect, useMemo } from 'react';

export function ReasoningNarratorView({ narrations, currentIngestion }) {
  // Guarantee absolute deduplication by mandate_id
  const uniqueNarrations = useMemo(() => {
    const map = new Map();
    for (const item of narrations) {
      if (item && item.mandate_id && !map.has(item.mandate_id)) {
        map.set(item.mandate_id, item);
      }
    }
    return Array.from(map.values());
  }, [narrations]);

  return (
    <div className="reasoning-panel">
      <div className="panel-header-sans">
        <span>Reasoning Trace (Real-time Explainable Audit)</span>
        <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>AI Policy Decisions</span>
      </div>

      <div className="reasoning-body">
        {/* If Ingestion in progress, show live synthesizer narrative */}
        {currentIngestion && (
          <div className="narrator-card" style={{ borderColor: 'var(--chrome)', backgroundColor: 'var(--chrome-dark)' }}>
            <div className="narrator-header-row">
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Protocol Ingestion Agent</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>STAGE: {currentIngestion.stage}</span>
            </div>
            <div className="narrator-text" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {currentIngestion.message}
              <span className="typewriter-cursor"></span>
            </div>
          </div>
        )}

        {uniqueNarrations.length === 0 && !currentIngestion ? (
          <div style={{ padding: '36px 16px', color: 'var(--chrome)', textAlign: 'center', fontSize: '13px', lineHeight: '1.6' }}>
            System idle. The Reasoning Narrator will stream contextual plain-English justifications in real time as autonomous buyer agents transact.
          </div>
        ) : (
          uniqueNarrations.map((item, index) => (
            <NarrativeCard key={item.mandate_id} item={item} isLatest={index === 0} />
          ))
        )}
      </div>
    </div>
  );
}

function NarrativeCard({ item, isLatest }) {
  const [displayedText, setDisplayedText] = useState(isLatest ? '' : item.text);

  useEffect(() => {
    if (!isLatest) {
      setDisplayedText(item.text);
      return;
    }

    // Typewriter effect to catch up with intentional pacing
    let currentIdx = 0;
    const fullText = item.text || '';
    setDisplayedText('');

    const interval = setInterval(() => {
      currentIdx += 2;
      setDisplayedText(fullText.slice(0, currentIdx));
      if (currentIdx >= fullText.length) {
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [item.text, isLatest]);

  return (
    <div className={`narrator-card ${item.decision || 'approved'}`}>
      <div className="narrator-header-row">
        <span className="narrator-mandate-id">Mandate: {item.mandate_id}</span>
        <span style={{ fontSize: '11px', color: 'var(--chrome)' }}>
          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="narrator-text">
        {displayedText}
        {isLatest && displayedText.length < (item.text?.length || 0) && (
          <span className="typewriter-cursor"></span>
        )}
      </div>
    </div>
  );
}
