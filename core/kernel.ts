import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Syslog } from './syslog';
import { Config } from './config';
import { connectDatabase } from './database';

// 1. Intercept all console output immediately at the top level
Syslog.interceptConsole();

export class Kernel {
  private client: Client;
  private isSecure: boolean = false;

  constructor() {
    Syslog.info('kernel', 'Initializing Boot Sequence...');
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
    });
  }

  private async runSecurityAudit() {
    Syslog.info('security', 'Running environment validation...');

    if (!Config.discord.core.token) {
      Syslog.error('security', 'Critical configuration missing. Halting boot.');
      process.exit(1);
    }

    this.isSecure = true;
    Syslog.success('security', 'System is secure. Configuration loaded.');
  }

  private async mountModules() {
    await connectDatabase();
    if (!this.isSecure) throw new Error("Cannot mount modules: System insecure.");
    Syslog.info('module_manager', 'Mounting system modules...');

    // Future command/event loading logic goes here

    Syslog.success('module_manager', 'All modules mounted successfully.');
  }

  private async launchNetworkInterface() {
    Syslog.info('network', 'Establishing connection to Discord Gateway...');

    this.client.once(Events.ClientReady, (c) => {
      Syslog.success('network', `Connection established. Logged in as ${c.user.tag}`);
      
      // 2. Start the midnight cron job for Discord summaries
      // (Assuming you add reportChannelId to your config.ts)
      if (Config.discord.channels?.report) {
        Syslog.initDailySummary(this.client, Config.discord.channels.report);
      }

      // 3. Log the successful boot to your Discord Audit channel
      if (Config.discord.channels?.audit) {
        Syslog.discordLog(this.client, Config.discord.channels.audit, {
          category: 'SYSTEM',
          action: 'BOOT',
          severity: 'info',
          actorType: 'system',
          description: `TasDyn OS Network Interface Online. Connected as ${c.user.tag}`,
          source: 'api',
          status: 'success'
        });
      }
    });

    try {
      await this.client.login(Config.discord.core.token);
    } catch (error) {
      Syslog.error('network', 'Failed to connect to Gateway.', error);
      process.exit(1);
    }
  }

  public async boot() {
    try {
      console.clear();
      Syslog.info('kernel', '--- STARTING SYSTEM ---');

      await this.runSecurityAudit();
      await this.mountModules();
      await this.launchNetworkInterface();

      Syslog.success('kernel', 'Boot sequence complete. System operational.');
    } catch (error) {
      Syslog.error('kernel', 'KERNEL PANIC: Boot sequence failed', error);
      process.exit(1);
    }
  }
}