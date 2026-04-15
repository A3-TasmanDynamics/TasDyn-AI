// src/syslog.ts
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import 'winston-daily-rotate-file';
import cron from 'node-cron';
import { 
  Client, 
  TextChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { Config } from './config'; 

// ==========================================
// 1. TYPES & SCHEMAS
// ==========================================
export type LogCategory = 'SYSTEM' | 'AUTH' | 'USER' | 'TICKET' | 'REPORT' | 'BROADCAST' | 'MOD' | 'ADMIN' | 'PORTAL' | 'ERROR';
export type LogAction = 'BOOT' | 'SHUTDOWN' | 'ERROR' | 'CONFIG_CHANGE' | 'LOGIN' | 'LOGOUT' | 'AUTH_FAILED' | 'USER_JOIN' | 'USER_LEAVE' | 'TICKET_CREATED' | 'REPORT_FILED' | 'REPORT_RESOLVED' | 'API_ERROR' | 'MESSAGE_DELETED';

export interface AuditLogEntry {
  category: LogCategory;
  action: LogAction;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actorType: 'system' | 'user' | 'bot';
  actorId?: string;
  actorUsername?: string;
  targetId?: string;
  targetName?: string;
  description: string;
  details?: Record<string, any>;
  source: 'discord' | 'website' | 'api';
  status: 'success' | 'failed' | 'pending';
}

// ==========================================
// 2. WINSTON ENGINE (Safe File Rotation)
// ==========================================
const logDirectory = path.join(process.cwd(), 'audit_logs');
if (!fs.existsSync(logDirectory)) fs.mkdirSync(logDirectory, { recursive: true });

const consoleFormat = winston.format.printf(({ level, message, timestamp, category, action, trace }) => {
  const levelStr = level === 'info' ? '[INFO] ' : level === 'warn' ? '[WARN] ' : level === 'error' ? '[FATAL]' : '[OK]   ';
  let out = `${levelStr} [${timestamp}] [${category || 'SYSTEM'}] [${action || 'LOG'}] ${message}`;
  if (trace) out += `\n${trace}`;
  return out;
});

const logger = winston.createLogger({
  levels: { error: 0, warn: 1, success: 2, info: 3 },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() 
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: logDirectory,
      filename: 'audit-%DATE%.json',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true, 
      maxSize: '20m',      
      maxFiles: '14d',     
    }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), consoleFormat)
    })
  ]
});

// ==========================================
// 3. THE UNIFIED API
// ==========================================
export class Syslog {
  private static originalLog = console.log;
  private static originalError = console.error;
  private static originalWarn = console.warn;

  // ==========================================
  // KERNEL HELPER METHODS (Restored)
  // ==========================================
  static info(module: string, message: string) {
    logger.log('info', message, { category: module.toUpperCase(), action: 'SYS_LOG' });
  }

  static warn(module: string, message: string) {
    logger.log('warn', message, { category: module.toUpperCase(), action: 'SYS_LOG' });
  }

  static error(module: string, message: string, trace?: any) {
    logger.log('error', message, { 
      category: module.toUpperCase(), 
      action: 'SYS_ERROR', 
      trace: trace instanceof Error ? trace.stack : JSON.stringify(trace) 
    });
  }

  static success(module: string, message: string) {
    logger.log('success', message, { category: module.toUpperCase(), action: 'SYS_LOG' });
  }

  // ==========================================
  // CORE AUDIT METHODS
  // ==========================================

  /**
   * Core Audit Writer - Saves structured JSON to file and console
   */
  static audit(entry: AuditLogEntry) {
    const level = entry.severity === 'critical' ? 'error' : entry.severity;
    
    // Pass the full entry object to Winston so it saves properly in the JSON
    logger.log(level, entry.description, { 
      ...entry, 
      id: `AL_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    });
  }

  /**
   * Discord Integration - Writes to JSON AND sends a Discord Embed
   */
  static async discordLog(
    client: Client, 
    channelId: string, 
    entry: AuditLogEntry
  ) {
    // 1. Write to the local black box first
    this.audit(entry);

    // 2. Send to Discord Presentation Layer
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const isRiskOrReport = ['RISK', 'REPORT'].includes(entry.category);
      
      const embed = new EmbedBuilder()
        .setAuthor({ name: `TASDYN_LOG // ${entry.category}`, iconURL: client.user?.displayAvatarURL() })
        .setDescription(`\`\`\`${entry.description}\`\`\``)
        .setColor(isRiskOrReport && entry.category !== 'REPORT' ? 0xff0000 : this.getColor(entry.category))
        .addFields(
          { name: 'Action', value: entry.action, inline: true },
          { name: 'Actor', value: entry.actorUsername || entry.actorType, inline: true }
        )
        .setFooter({ text: `Status: ${entry.status.toUpperCase()}` })
        .setTimestamp();

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      
      // Moderation Buttons
      if (isRiskOrReport && entry.targetId) {
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`mod_mute_${entry.targetId}`).setLabel('Mute (1h)').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`mod_kick_${entry.targetId}`).setLabel('Kick').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`mod_ban_${entry.targetId}`).setLabel('Ban').setStyle(ButtonStyle.Secondary)
        );

        if (entry.category === 'REPORT') {
          actionRow.addComponents(
            new ButtonBuilder().setCustomId('report_resolve').setLabel('Mark Resolved').setStyle(ButtonStyle.Success)
          );
        }
        components.push(actionRow);
      }

      await channel.send({ embeds: [embed], components });
    } catch (error) {
      logger.error('Discord Logging Pipeline Failure', { trace: error });
    }
  }

  /**
   * Initializes the Daily Midnight Discord Summary
   */
  static initDailySummary(client: Client, reportChannelId: string) {
    cron.schedule('0 0 * * *', async () => {
      this.audit({
        category: 'SYSTEM',
        action: 'BOOT', // Reusing action for brevity
        severity: 'info',
        actorType: 'system',
        description: 'Initiating midnight maintenance protocol. Winston handling file rotation.',
        source: 'api',
        status: 'success'
      });

      try {
        const channel = await client.channels.fetch(reportChannelId) as TextChannel;
        if (!channel) return;

        const summaryEmbed = new EmbedBuilder()
          .setTitle('📊 TASDYN_SEC // DAILY SUMMARY')
          .setDescription('Log rotation successful. Previous 24h data has been archived securely.')
          .addFields(
            { name: 'SYSTEM_STATUS', value: '🟢 NOMINAL', inline: true },
            { name: 'ARCHIVE_ID', value: `\`${new Date().toISOString().split('T')[0]}\``, inline: true }
          )
          .setColor(0x2ecc71)
          .setTimestamp();

        await channel.send({ embeds: [summaryEmbed] });
      } catch (error) {
        logger.error('Failed to send daily summary', { trace: error });
      }
    });
  }

  /**
   * Console Interception (From your ConsoleLogger)
   * Run this once in your Kernel boot sequence.
   */
  static interceptConsole() {
    console.log = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      this.audit({ category: 'SYSTEM', action: 'BOOT', severity: 'info', actorType: 'system', description: msg, source: 'api', status: 'success' });
    };

    console.warn = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      this.audit({ category: 'SYSTEM', action: 'ERROR', severity: 'warning', actorType: 'system', description: msg, source: 'api', status: 'success' });
    };

    console.error = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      this.audit({ category: 'ERROR', action: 'API_ERROR', severity: 'error', actorType: 'system', description: msg, source: 'api', status: 'failed' });
    };
  }

  // Helper for embed colors
  private static getColor(category: string): number {
    switch (category) {
        case 'SYSTEM': return 0x3498db; 
        case 'AUTH': return 0xf1c40f;   
        case 'REPORT': return 0x9b59b6; 
        case 'TICKET': return 0x1abc9c; 
        case 'USER': return 0x2ecc71;
        case 'ERROR': return 0xe74c3c;
        default: return 0x95a5a6;       
    }
  }
}