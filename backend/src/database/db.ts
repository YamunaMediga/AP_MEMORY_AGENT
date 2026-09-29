import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const dataDir = path.resolve(process.cwd(), 'data');
const dbFilePath = path.join(dataDir, 'ap_agent.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  persistDb();

  return dbInstance;
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'reviewer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ref_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      applicant_name TEXT NOT NULL,
      notes TEXT,
      external_url TEXT,
      status TEXT DEFAULT 'pending',
      agent_decision TEXT,
      agent_rationale TEXT,
      recalled_memory_json TEXT,
      invoice_number TEXT,
      invoice_date TEXT,
      pdf_hash TEXT,
      pdf_filename TEXT,
      raw_extracted_text TEXT,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      instruction TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      hindsight_status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      request_id TEXT,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS memory_records (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      memory_type TEXT DEFAULT 'policy',
      context TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Safe migrations for existing databases
  const requestCols = [
    'invoice_number TEXT',
    'invoice_date TEXT',
    'pdf_hash TEXT',
    'pdf_filename TEXT',
    'raw_extracted_text TEXT',
    'is_duplicate INTEGER DEFAULT 0',
    'duplicate_of_ref TEXT',
    'learned_insights_json TEXT',
    'po_number TEXT',
    'po_amount REAL',
    'discrepancy_detected INTEGER DEFAULT 0',
    'discrepancy_type TEXT',
    'discrepancy_details TEXT',
    'discrepancy_amount REAL',
    'human_decision TEXT',
    'human_comment TEXT',
    'exception_granted TEXT',
    'audit_trail_json TEXT',
    'amount_label TEXT',
    'extraction_method TEXT',
    'formatted_amount TEXT',
    'confidence REAL',
    'line_items_json TEXT',
    'tax_amount REAL',
    'discount_amount REAL',
    'shipping_amount REAL',
    'validation_status TEXT',
  ];
  for (const col of requestCols) {
    try {
      db.run(`ALTER TABLE requests ADD COLUMN ${col};`);
    } catch (e) {
      // Column already exists
    }
  }

  // Enforce data-layer uniqueness constraints to prevent duplicate insertions
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_pdf_hash ON requests(user_id, pdf_hash) WHERE pdf_hash IS NOT NULL AND pdf_hash != '';`);
  } catch (e) {
    // Index may already exist or duplicates present
  }
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_vendor_inv ON requests(user_id, LOWER(applicant_name), LOWER(invoice_number)) WHERE invoice_number IS NOT NULL AND invoice_number != '';`);
  } catch (e) {
    // Index may already exist or duplicates present
  }

  const memoryCols = [
    'vendor_name TEXT',
    'invoice_ref TEXT',
    'discrepancy_type TEXT',
    'human_decision TEXT',
    'exception_note TEXT',
    'why_relevant TEXT',
    'learning_scope TEXT',
  ];
  for (const col of memoryCols) {
    try {
      db.run(`ALTER TABLE memory_records ADD COLUMN ${col};`);
    } catch (e) {
      // Column already exists
    }
  }
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized. Call getDb() first.');
  const stmt = dbInstance.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: any[] = []): { changes: number } {
  if (!dbInstance) throw new Error('Database not initialized. Call getDb() first.');
  dbInstance.run(sql, params);
  persistDb();
  return { changes: dbInstance.getRowsModified() };
}
