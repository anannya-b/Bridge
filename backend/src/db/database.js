import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { updateMandateStatus } from '../core/canonicalMandate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DEFAULT_DB_DIR)) {
  fs.mkdirSync(DEFAULT_DB_DIR, { recursive: true });
}
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'bridge.db');

export class MandateDatabase {
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.db = null;
    this.queue = Promise.resolve();
  }

  async init() {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);

        this.db.serialize(() => {
          this.db.run('PRAGMA journal_mode = WAL;');
          this.db.run('PRAGMA busy_timeout = 5000;');

          // Create mandates table with strict UNIQUE constraint on mandate_id
          const createTableSql = `
            CREATE TABLE IF NOT EXISTS mandates (
              mandate_id TEXT PRIMARY KEY,
              agent_id TEXT NOT NULL,
              origin_protocol TEXT NOT NULL,
              merchant_id TEXT NOT NULL,
              items TEXT,
              total_amount REAL NOT NULL,
              currency TEXT NOT NULL DEFAULT 'INR',
              spend_cap_checked_against REAL,
              agent_trust_tier INTEGER,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              signature TEXT NOT NULL,
              metadata TEXT,
              razorpay_order_id TEXT,
              reason TEXT,
              CONSTRAINT uq_mandate_id UNIQUE (mandate_id)
            )
          `;

          this.db.run(createTableSql, (tableErr) => {
            if (tableErr) return reject(tableErr);
            resolve(this);
          });
        });
      });
    });
  }

  /**
   * Serializes async database operations to maintain atomic isolation across high-concurrency requests
   */
  async _runQueued(fn) {
    const result = this.queue.then(() => fn());
    this.queue = result.catch(() => {});
    return result;
  }

  /**
   * Inserts a mandate wrapped in a single atomic transaction.
   * Catches uniqueness violations and returns 'DUPLICATE_REJECTED' status instead of crashing.
   * @param {object} mandate 
   * @returns {Promise<{ success: boolean, duplicate: boolean, mandate: object, error?: string }>}
   */
  async insertMandateAtomic(mandate) {
    if (!this.db) await this.init();

    return this._runQueued(() => {
      return new Promise((resolve, reject) => {
        this.db.serialize(() => {
          this.db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
            if (beginErr) {
              // If already in transaction or busy, attempt direct insert within engine transaction
            }

            const insertSql = `
              INSERT INTO mandates (
                mandate_id,
                agent_id,
                origin_protocol,
                merchant_id,
                items,
                total_amount,
                currency,
                spend_cap_checked_against,
                agent_trust_tier,
                status,
                created_at,
                expires_at,
                signature,
                metadata,
                razorpay_order_id,
                reason
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
              mandate.mandate_id,
              mandate.agent_id,
              mandate.origin_protocol,
              mandate.merchant_id || 'kirana_test_04',
              JSON.stringify(mandate.items || []),
              Number(mandate.total_amount),
              mandate.currency || 'INR',
              mandate.spend_cap_checked_against ? Number(mandate.spend_cap_checked_against) : null,
              mandate.agent_trust_tier ? Number(mandate.agent_trust_tier) : 1,
              mandate.status || 'pending',
              mandate.created_at,
              mandate.expires_at,
              mandate.signature,
              JSON.stringify(mandate.metadata || {}),
              mandate.razorpay_order_id || null,
              mandate.reason || null
            ];

            this.db.run(insertSql, params, (insertErr) => {
              if (insertErr) {
                const isUniqueConstraintViolation = 
                  insertErr.code === 'SQLITE_CONSTRAINT' || 
                  (insertErr.message && insertErr.message.includes('UNIQUE constraint failed'));

                this.db.run('ROLLBACK', () => {
                  if (isUniqueConstraintViolation) {
                    const duplicateRejectedMandate = updateMandateStatus(
                      mandate,
                      'DUPLICATE_REJECTED',
                      { reason: `Duplicate transaction rejected: mandate_id "${mandate.mandate_id}" already exists in database.` }
                    );

                    return resolve({
                      success: false,
                      duplicate: true,
                      mandate: duplicateRejectedMandate,
                      error: insertErr.message
                    });
                  }

                  return reject(insertErr);
                });
                return;
              }

              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  this.db.run('ROLLBACK', () => reject(commitErr));
                  return;
                }

                resolve({
                  success: true,
                  duplicate: false,
                  mandate
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Updates mandate state
   */
  async updateMandate(mandate) {
    if (!this.db) await this.init();

    return this._runQueued(() => {
      return new Promise((resolve, reject) => {
        const updateSql = `
          UPDATE mandates
          SET status = ?,
              signature = ?,
              razorpay_order_id = ?,
              reason = ?,
              items = ?,
              total_amount = ?,
              spend_cap_checked_against = ?,
              agent_trust_tier = ?
          WHERE mandate_id = ?
        `;

        const params = [
          mandate.status,
          mandate.signature,
          mandate.razorpay_order_id || null,
          mandate.reason || null,
          JSON.stringify(mandate.items || []),
          Number(mandate.total_amount),
          mandate.spend_cap_checked_against ? Number(mandate.spend_cap_checked_against) : null,
          mandate.agent_trust_tier ? Number(mandate.agent_trust_tier) : 1,
          mandate.mandate_id
        ];

        this.db.run(updateSql, params, function (err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0, mandate });
        });
      });
    });
  }

  /**
   * Fetches mandate by ID
   */
  async getMandateById(mandateId) {
    if (!this.db) await this.init();

    return this._runQueued(() => {
      return new Promise((resolve, reject) => {
        this.db.get('SELECT * FROM mandates WHERE mandate_id = ?', [mandateId], (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);

          resolve({
            ...row,
            items: row.items ? JSON.parse(row.items) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          });
        });
      });
    });
  }

  /**
   * Retrieves recent mandates
   */
  async getRecentMandates(limit = 50) {
    if (!this.db) await this.init();

    return this._runQueued(() => {
      return new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM mandates ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
          if (err) return reject(err);
          const mandates = (rows || []).map(row => ({
            ...row,
            items: row.items ? JSON.parse(row.items) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          }));
          resolve(mandates);
        });
      });
    });
  }

  /**
   * Clears table for reset
   */
  async clear() {
    if (!this.db) await this.init();
    return this._runQueued(() => {
      return new Promise((resolve, reject) => {
        this.db.run('DELETE FROM mandates', (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) return reject(err);
          this.db = null;
          resolve();
        });
      });
    }
  }
}

export const mandateDb = new MandateDatabase();
