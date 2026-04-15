import Database from 'better-sqlite3';
import path from 'path';
import { Syslog } from './syslog';

const dbPath = path.join(process.cwd(), 'database.db');
export const db = new Database(dbPath);

// Enable WAL for performance
db.pragma('journal_mode = WAL');

export const connectDatabase = async () => {
  Syslog.info('storage', 'Mounting high-performance SQLite driver...');
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discordId TEXT UNIQUE NOT NULL,
        username TEXT,
        status TEXT DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    Syslog.success('storage', 'Database connection established and tables verified.');
  } catch (error) {
    Syslog.error('storage', 'FATAL: Storage drive failure.', error);
    process.exit(1);
  }
};