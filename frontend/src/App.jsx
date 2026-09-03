import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ScenarioDock } from './components/ScenarioDock';
import { MandateStream } from './components/MandateStream';
import { ReasoningNarratorView } from './components/ReasoningNarratorView';
import { ProtocolLanes } from './components/ProtocolLanes';
import { MandateDetailModal } from './components/MandateDetailModal';
import { IngestSpecModal } from './components/IngestSpecModal';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [merchant, setMerchant] = useState({ merchant_id: 'kirana_test_04' });
  const [adapters, setAdapters] = useState([
    { protocolId: 'acp', name: 'Google ACP', version: '2026.1', status: 'active' },
    { protocolId: 'ap2', name: 'NPCI UAP / AP2', version: '1.2', status: 'active' }
  ]);
  const [mandates, setMandates] = useState([]);
  const [narrations, setNarrations] = useState([]);
  const [selectedMandate, setSelectedMandate] = useState(null);
  const [killSwitchTriggeredId, setKillSwitchTriggeredId] = useState(null);
  const [globalHalt, setGlobalHalt] = useState(false);
  
  const [ingestionProgress, setIngestionProgress] = useState(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(null);

  const wsRef = useRef(null);

  // Setup WebSocket Connection
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3001`;

    function connect() {
      if (!isMounted) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) setIsConnected(true);
      };

      ws.onclose = () => {
        if (isMounted) {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (err) => {
        console.warn('WS Error:', err);
      };

      ws.onmessage = (messageEvent) => {
        if (!isMounted) return;
        try {
          const { event, data } = JSON.parse(messageEvent.data);
          
          if (event === 'INIT_STATE') {
            if (data.merchant) setMerchant(data.merchant);
            if (data.adapters) setAdapters(data.adapters);
            if (data.recentMandates) setMandates(data.recentMandates);
            if (data.recentNarrations) setNarrations(data.recentNarrations);
          }

          if (event === 'MANDATE_CREATED') {
            setMandates(prev => {
              if (prev.some(m => m.mandate_id === data.mandate.mandate_id)) {
                return prev.map(m => m.mandate_id === data.mandate.mandate_id ? data.mandate : m);
              }
              return [data.mandate, ...prev].slice(0, 100);
            });
          }

          if (event === 'MANDATE_UPDATED') {
            setMandates(prev => prev.map(m => m.mandate_id === data.mandate.mandate_id ? data.mandate : m));
          }

          if (event === 'NARRATION_READY') {
            setNarrations(prev => {
              if (prev.some(n => n.mandate_id === data.mandate_id)) {
                return prev.map(n => n.mandate_id === data.mandate_id ? data : n);
              }
              return [data, ...prev].slice(0, 50);
            });
          }

          if (event === 'KILL_SWITCH_TRIPPED') {
            setKillSwitchTriggeredId(data.mandate_id);
            // Clear pulse highlight after 3.5 seconds
            setTimeout(() => {
              if (isMounted) setKillSwitchTriggeredId(null);
            }, 3500);
          }

          if (event === 'INGESTION_PROGRESS') {
            setIngestionProgress(data);
            if (data.progress >= 100) {
              setTimeout(() => {
                if (isMounted) setIngestionProgress(null);
              }, 3000);
            }
          }

          if (event === 'ADAPTER_REGISTERED') {
            if (data.adaptersList) {
              setAdapters(data.adaptersList);
            }
          }

          if (event === 'STATE_RESET') {
            setMandates([]);
            setNarrations([]);
            setKillSwitchTriggeredId(null);
            setIngestionProgress(null);
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleRunScenario = async (scenarioName) => {
    setLoadingScenario(scenarioName);
    try {
      const res = await fetch(`/api/scenario/${scenarioName}`, { method: 'POST' });
      await res.json();
    } catch (err) {
      console.error('Scenario failed:', err);
    } finally {
      setLoadingScenario(null);
    }
  };

  const handleCustomIngest = async (specText) => {
    setLoadingScenario('custom_ingest');
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specText })
      });
      await res.json();
      setIsIngestModalOpen(false);
    } catch (err) {
      console.error('Ingest failed:', err);
    } finally {
      setLoadingScenario(null);
    }
  };

  const handleToggleGlobalHalt = () => {
    setGlobalHalt(prev => !prev);
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <Header
        merchant={merchant}
        isConnected={isConnected}
        globalHalt={globalHalt}
        onToggleHalt={handleToggleGlobalHalt}
      />

      {/* Scenario Trigger Dock */}
      <ScenarioDock
        onRunScenario={handleRunScenario}
        loadingScenario={loadingScenario}
        onOpenIngestModal={() => setIsIngestModalOpen(true)}
      />

      {/* Main Split Console */}
      <main className="deck-split">
        {/* Left: Terminal-style Mandate Stream (Monospace) */}
        <MandateStream
          mandates={mandates}
          selectedMandate={selectedMandate}
          onSelectMandate={setSelectedMandate}
          killSwitchTriggeredId={killSwitchTriggeredId}
        />

        {/* Right: Grotesk Sans Reasoning Narrator (Inter) */}
        <ReasoningNarratorView
          narrations={narrations}
          currentIngestion={ingestionProgress}
        />
      </main>

      {/* Bottom Protocol Lanes Strip */}
      <ProtocolLanes
        adapters={adapters}
        ingestionProgress={ingestionProgress}
        onSelectAdapter={(adapter) => console.log('Selected adapter:', adapter)}
      />

      {/* Mandate Inspector Modal */}
      <MandateDetailModal
        mandate={selectedMandate}
        onClose={() => setSelectedMandate(null)}
      />

      {/* Custom Spec Ingestion Modal */}
      <IngestSpecModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onIngest={handleCustomIngest}
        isIngesting={loadingScenario === 'custom_ingest'}
      />
    </div>
  );
}
