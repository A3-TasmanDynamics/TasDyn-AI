import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import { Syslog } from './syslog';
import { connectDatabase } from './database';
import { CommandModule } from './types'; // Ensure you have this interface defined
import { mountMemberEvents } from '../modules/iam/memberEvents';
import { mountInteractionManager } from '../modules/interactionManager';
import { deploySecurityGate } from '../modules/iam/setup'; 
import { deploySupportHub } from '../modules/tickets/setup';

// Import Modular Commands
import { OperatorCommand } from '../modules/commands/operator';

/**
 * Sovereign OS Kernel
 * Central controller for Tasman Dynamics software systems.
 */
export class Kernel {
  public client: Client;
  public commands: Collection<string, CommandModule> = new Collection();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent
      ],
    });
  }

  /**
   * Mounts user-space modules and modular commands into the system kernel.
   */
  private async mountModules() {
    Syslog.info('module_manager', 'Mounting system modules and command registry...');
    
    // 1. Register Modular Commands
    this.commands.set(OperatorCommand.data.name, OperatorCommand);
    // Add future commands here: this.commands.set(TicketCommand.data.name, TicketCommand);

    // 2. Initialize Event Listeners
    mountMemberEvents(this.client);
    
    // 3. Initialize Interaction Controller (Passing 'this' to allow command access)
    mountInteractionManager(this);

    Syslog.success('module_manager', `Mounted ${this.commands.size} commands and system events.`);
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
        // Bind the authenticated client to the Syslog engine
        Syslog.init(this.client); 

        Syslog.success('kernel', `TasDyn AI Online. Authenticated as ${c.user.tag}`);
        
        // --- Deployment Hooks ---
        // Deploy the Security Gate for user authentication
        await deploySecurityGate(this.client);
        
        // Deploy the Support Hub (Ticket Entry Point)
        await deploySupportHub(this.client);

        // Start mirroring terminal output to Discord logs
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