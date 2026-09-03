import React from 'react';

export function MandateDetailModal({ mandate, onClose }) {
  if (!mandate) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>MANDATE INSPECTOR: {mandate.mandate_id}</span>
          <button className="close-btn" onClick={onClose}>[ESC / CLOSE]</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <span style={{ color: 'var(--chrome)' }}>Origin Protocol:</span> {mandate.origin_protocol?.toUpperCase()}
              <br />
              <span style={{ color: 'var(--chrome)' }}>Agent Identity:</span> {mandate.agent_id}
              <br />
              <span style={{ color: 'var(--chrome)' }}>Trust Tier:</span> Tier {mandate.agent_trust_tier}
            </div>

            <div>
              <span style={{ color: 'var(--chrome)' }}>Total Amount:</span> ₹{mandate.total_amount?.toLocaleString()} {mandate.currency}
              <br />
              <span style={{ color: 'var(--chrome)' }}>Status:</span>{' '}
              <span className={`status-text ${mandate.status}`}>{mandate.status?.toUpperCase()}</span>
              <br />
              <span style={{ color: 'var(--chrome)' }}>Razorpay Order ID:</span>{' '}
              {mandate.razorpay_order_id || 'N/A (Unsettled)'}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: 'var(--chrome)', textTransform: 'uppercase' }}>
              Cryptographic HMAC-SHA256 Signature (Merchant Verified):
            </span>
            <div className="code-box" style={{ color: 'var(--approve)', padding: '6px 10px', fontSize: '10px' }}>
              {mandate.signature}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: 'var(--chrome)', textTransform: 'uppercase' }}>
              Line Items in Mandate:
            </span>
            <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse', border: '1px solid var(--chrome-dim)' }}>
              <thead>
                <tr style={{ background: 'var(--chrome-dark)', color: 'var(--chrome)', textAlign: 'left', fontSize: '10px' }}>
                  <th style={{ padding: '4px 8px' }}>SKU</th>
                  <th style={{ padding: '4px 8px' }}>QUANTITY</th>
                  <th style={{ padding: '4px 8px' }}>UNIT PRICE</th>
                  <th style={{ padding: '4px 8px' }}>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {mandate.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--chrome-dark)' }}>
                    <td style={{ padding: '4px 8px' }}>{item.sku}</td>
                    <td style={{ padding: '4px 8px' }}>{item.qty}</td>
                    <td style={{ padding: '4px 8px' }}>₹{item.unit_price}</td>
                    <td style={{ padding: '4px 8px' }}>₹{item.unit_price * item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <span style={{ color: 'var(--chrome)', textTransform: 'uppercase' }}>
              Canonical Mandate Object (Raw JSON):
            </span>
            <div className="code-box">
              {JSON.stringify(mandate, null, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
