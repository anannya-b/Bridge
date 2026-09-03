import { AcpAdapter } from './acpAdapter.js';
import { Ap2Adapter } from './ap2Adapter.js';

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.initDefaultAdapters();
  }

  initDefaultAdapters() {
    const acp = new AcpAdapter();
    const ap2 = new Ap2Adapter();
    this.adapters.set('acp', acp);
    this.adapters.set('ap2', ap2);
  }

  getAdapter(protocolId) {
    if (!protocolId) return null;
    return this.adapters.get(protocolId.toLowerCase()) || null;
  }

  registerAdapter(adapter) {
    if (!adapter || !adapter.protocolId) {
      throw new Error('Adapter must define protocolId');
    }
    this.adapters.set(adapter.protocolId.toLowerCase(), adapter);
    return adapter;
  }

  listAdapters() {
    return Array.from(this.adapters.values()).map(a => ({
      protocolId: a.protocolId,
      name: a.name,
      version: a.version,
      status: a.status,
      isDynamic: a.isDynamic || false,
      ingestedAt: a.ingestedAt || null
    }));
  }

  removeAdapter(protocolId) {
    return this.adapters.delete(protocolId.toLowerCase());
  }
}

export const adapterRegistry = new AdapterRegistry();
