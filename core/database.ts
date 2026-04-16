import Database from 'better-sqlite3';
import path from 'path';
import { Syslog } from './syslog';

const dbPath = path.join(process.cwd(), 'database.db');
export const db = new Database(dbPath);

// Enable WAL for high-concurrency performance
db.pragma('journal_mode = WAL');

export const connectDatabase = async () => {
  Syslog.info('storage', 'Mounting high-performance SQLite driver...');
  try {
    // 1. Core Table Initialization
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discordId TEXT UNIQUE NOT NULL,
        username TEXT,
        status TEXT DEFAULT 'pending',
        welcomeMessageId TEXT, 
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channelId TEXT UNIQUE NOT NULL,
        creatorId TEXT NOT NULL,
        subject TEXT,
        status TEXT DEFAULT 'open',
        transcript TEXT, 
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        closedAt DATETIME
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS github_commits (
        repoName TEXT PRIMARY KEY,
        lastSha TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Schema Evolution (Auto-Patch)
    // Checks if the welcomeMessageId column exists in case the table was created previously
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasWelcomeId = tableInfo.some(col => col.name === 'welcomeMessageId');

    if (!hasWelcomeId) {
        Syslog.info('storage', 'Legacy schema detected. Patching table: users...');
        db.prepare("ALTER TABLE users ADD COLUMN welcomeMessageId TEXT").run();
        Syslog.success('storage', 'Schema patched successfully: welcomeMessageId added.');
    }

    Syslog.success('storage', 'Database connection established and tables verified.');
  } catch (error) {
    Syslog.error('storage', 'FATAL: Storage drive failure.', error);
    process.exit(1);
  }
};