import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Syslog } from './syslog';
import { connectDatabase } from './database';
import { mountMemberEvents } from '../modules/iam/memberEvents';
import { mountInteractionManager } from '../modules/interactionManager';
import { deploySecurityGate } from '../modules/iam/setup'; 

/**
 * Sovereign OS Kernel
 * Central controller for Tasman Dynamics software systems.
 */
export class Kernel {
  private client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, // REQUIRED for join/leave tracking
        GatewayIntentBits.MessageContent
      ],
    });
  }

  /**
   * Mounts user-space modules into the system kernel.
   */
  private async mountModules() {
    Syslog.info('module_manager', 'Mounting system modules...');
    
    // These modules now have access to Syslog via the Kernel bridge
    mountMemberEvents(this.client);
    mountInteractionManager(this.client);

    Syslog.success('module_manager', 'All modules mounted successfully.');
  }

  /**
   * Main boot sequence: Storage -> Modules -> Network -> Ready.
   */
  public async boot() {
    try {
      console.clear();
      Syslog.info('kernel', '--- STARTING SYSTEM ---');

      // 1. Initialize Storage Controller (better-sqlite3)
      await connectDatabase();
      
      // 2. Mount Identity and Interrupt Controllers
      await this.mountModules();

      // 3. Post-Boot Hook (Ready Event)
      this.client.once(Events.ClientReady, async (c) => {
        // --- THE MISSING LINK ---
        // Bind the authenticated client to the Syslog engine
        Syslog.init(this.client); 

        Syslog.success('kernel', `TasDyn AI Online. Authenticated as ${c.user.tag}`);
        
        // Deploy the Security Gate for user authentication
        await deploySecurityGate(this.client);

        // Start mirroring terminal output to Discord tasdyn_logs channel
        Syslog.interceptConsole();
        
        Syslog.info('kernel', 'Boot sequence complete. System operational.');
      });

      // 4. Finalize Network Interface
      await this.client.login(process.env.DISCORD_CORE_TOKEN);

    } catch (error) {
      Syslog.error('kernel', 'KERNEL PANIC: Boot sequence interrupted.', error);
      process.exit(1);
    }
  }
}