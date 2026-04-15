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
  ButtonStyle,
  ColorResolvable 
} from 'discord.js';
import { Config } from './config'; 

// ==========================================
// 1. TYPES & SCHEMAS
// ==========================================
export type LogCategory = 'SYSTEM' | 'AUTH' | 'USER' | 'TICKET' | 'REPORT' | 'BROADCAST' | 'MOD' | 'ADMIN' | 'PORTAL' | 'ERROR';
export type LogAction = 'BOOT' | 'SHUTDOWN' | 'ERROR' | 'CONFIG_CHANGE' | 'LOGIN' | 'LOGOUT' | 'AUTH_FAILED' | 'USER_JOIN' | 'USER_LEAVE' | 'TICKET_CREATED' | 'REPORT_FILED' | 'REPORT_RESOLVED' | 'API_ERROR' | 'MESSAGE_DELETED' | 'CONSOLE';

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
// 2. WINSTON ENGINE (Local Persistence)
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
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
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
  private static client: Client | null = null;
  private static isIntercepting = false;

  /**
   * Bind the Discord Client to the Syslog engine after boot.
   */
  public static init(client: Client) {
    this.client = client;
  }

  // --- KERNEL HELPERS ---
  
  static info(module: string, message: string, category: LogCategory = 'SYSTEM') {
    logger.log('info', message, { category, action: 'SYS_LOG' });
    this.autoDispatch(category, `[${module.toUpperCase()}] ${message}`, 'info');
  }

  static warn(module: string, message: string, category: LogCategory = 'SYSTEM') {
    logger.log('warn', message, { category, action: 'SYS_LOG' });
    this.autoDispatch(category, `[${module.toUpperCase()}] ${message}`, 'warning');
  }

  static error(module: string, message: string, trace?: any) {
    const stack = trace instanceof Error ? trace.stack : JSON.stringify(trace);
    logger.log('error', message, { category: 'ERROR', action: 'SYS_ERROR', trace: stack });
    this.autoDispatch('ERROR', `${message}${stack ? `\n${stack}` : ''}`, 'error');
  }

  static success(module: string, message: string, category: LogCategory = 'SYSTEM') {
    logger.log('success', message, { category, action: 'SYS_LOG' });
    this.autoDispatch(category, `[${module.toUpperCase()}] ${message}`, 'info');
  }

  // --- CORE AUDIT METHODS ---

  /**
   * Core Audit Writer - Saves structured JSON to file and console.
   */
  static audit(entry: AuditLogEntry) {
    const level = entry.severity === 'critical' ? 'error' : 
                  entry.severity === 'warning' ? 'warn' : 
                  entry.severity === 'info' ? 'info' : 'success';
    
    logger.log(level, entry.description, { 
      ...entry, 
      id: `AL_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    });
  }

  /**
   * Internal bridge to route system logs to Discord presentation layer.
   */
  private static autoDispatch(category: LogCategory, description: string, severity: AuditLogEntry['severity']) {
    if (!this.client) return;
    this.discordLog(this.client, this.resolveChannel(category), {
      category,
      action: 'SYS_LOG',
      severity,
      actorType: 'system',
      description,
      source: 'api',
      status: 'success'
    });
  }

  /**
   * Dispatch log entry to a specific Discord channel as a formatted embed.
   */
  static async discordLog(client: Client, channelId: string | undefined, entry: AuditLogEntry) {
    // Only audit to Winston if we aren't already intercepting console (prevents double logging)
    if (!this.isIntercepting) this.audit(entry);
    if (!channelId) return;

    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setAuthor({ 
          name: `TASDYN_LOG // ${entry.category}`, 
          iconURL: client.user?.displayAvatarURL() 
        })
        .setDescription(`\`\`\`${entry.description.substring(0, 2000)}\`\`\``)
        .setColor(this.getColor(entry.category))
        .addFields(
          { name: 'Action', value: entry.action, inline: true },
          { name: 'Actor', value: entry.actorUsername || entry.actorType, inline: true }
        )
        .setFooter({ text: `Status: ${entry.status.toUpperCase()}` })
        .setTimestamp();

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      
      // Moderation Intercepts
      if (['RISK', 'REPORT', 'ERROR'].includes(entry.category) && entry.targetId) {
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`mod_mute_${entry.targetId}`).setLabel('Mute (1h)').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`mod_kick_${entry.targetId}`).setLabel('Kick').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`mod_ban_${entry.targetId}`).setLabel('Ban').setStyle(ButtonStyle.Secondary)
        );
        components.push(actionRow);
      }

      await channel.send({ embeds: [embed], components });
    } catch (error) {
      // Direct write to stdout to avoid recursive loops if logging itself fails
      process.stdout.write(`[DISCORD_LOG_FAILURE] ${error}\n`);
    }
  }

  // --- INITIALIZATION & INTERCEPTION ---

  /**
   * Replaces standard console functions with Syslog interrupts.
   */
  static interceptConsole() {
    if (this.isIntercepting) return;
    this.isIntercepting = true;

    console.log = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      logger.log('info', msg, { category: 'SYSTEM', action: 'CONSOLE' });
      this.autoDispatch('SYSTEM', msg, 'info');
    };

    console.warn = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      logger.log('warn', msg, { category: 'SYSTEM', action: 'CONSOLE' });
      this.autoDispatch('SYSTEM', msg, 'warning');
    };

    console.error = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      logger.log('error', msg, { category: 'ERROR', action: 'CONSOLE' });
      this.autoDispatch('ERROR', msg, 'error');
    };
  }

  static initDailySummary(client: Client, reportChannelId: string) {
    cron.schedule('0 0 * * *', async () => {
      this.info('SYSTEM', 'Initiating midnight maintenance protocol.');
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

  // --- HELPERS ---

  /**
   * Resolves the target Discord channel ID based on the category routing table in Config.
   */
  private static resolveChannel(category: LogCategory): string | undefined {
    // Look up the routing table to find which channel key to use
    const targetKey = Config.log_routing[category];
    
    // Fetch the actual ID from the channel config
    // @ts-ignore - Dynamic key mapping
    const channelId = Config.discord.channels[targetKey];

    // Fallback to primary tasdyn_logs if specific route is undefined
    return channelId || Config.discord.channels.tasdyn_logs;
  }

  private static getColor(category: string): ColorResolvable {
    switch (category) {
        case 'SYSTEM': return 0x3498db; 
        case 'AUTH': return 0xf1c40f;   
        case 'REPORT': return 0x9b59b6; 
        case 'TICKET': return 0x1abc9c; 
        case 'USER': return 0x2ecc71;
        case 'ERROR': return 0xe74c3c;
        case 'BROADCAST': return 0x34495e;
        default: return 0x95a5a6;       
    }
  }
}