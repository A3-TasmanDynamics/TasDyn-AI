import { Client, GatewayIntentBits, Events, Collection, MessageFlags } from 'discord.js';
import { Syslog } from './syslog';
import { connectDatabase } from './database';
import { CommandModule, ModuleConfig } from './types';

/**
 * Sovereign OS Kernel
 * Reads registered ModuleConfigs and drives them — commands, events,
 * interaction handlers, and ready hooks are all declared by the modules
 * themselves. The Kernel is the brain; modules are its limbs.
 */
export class Kernel {
    public client: Client;
    public commands: Collection<string, CommandModule> = new Collection();
    private modules: ModuleConfig[];

    constructor(modules: ModuleConfig[]) {
        this.modules = modules;

        // Collect all gateway intents declared by modules, merged with base requirements
        const moduleIntents = modules.flatMap(m => m.intents ?? []);
        const baseIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent];
        const allIntents = [...new Set([...baseIntents, ...moduleIntents])];

        this.client = new Client({ intents: allIntents });
    }

    /**
     * Iterates all module configs and wires up commands, events, and the IRQ dispatcher.
     */
    private async mountModules() {
        Syslog.info('module_manager', `Mounting ${this.modules.length} system modules...`);

        for (const mod of this.modules) {
            // Register slash commands into the kernel registry
            for (const cmd of mod.commands ?? []) {
                this.commands.set(cmd.data.name, cmd);
            }

            // Attach event listeners declared by the module
            for (const event of mod.events ?? []) {
                event(this.client);
            }

            Syslog.info(
                'module_manager',
                `[${mod.name.toUpperCase()}] Mounted — ${mod.commands?.length ?? 0} commands, ` +
                `${mod.events?.length ?? 0} events, ${mod.interactions?.length ?? 0} interaction handlers.`
            );
        }

        // Mount the unified IRQ dispatcher after all modules are wired
        this.mountIRQ();

        Syslog.success('module_manager', `Registry ready — ${this.commands.size} commands active across ${this.modules.length} modules.`);
    }

    /**
     * Interaction Interrupt Controller (IRQ)
     * A single event listener that routes all Discord interactions to the
     * correct handler declared inside each module's config.
     */
    private mountIRQ() {
        Syslog.info('irq_controller', 'Mounting Interaction Interrupt Controller...');

        // Build a flat handler list from all modules once at mount time
        const handlers = this.modules.flatMap(m => m.interactions ?? []);

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                // ==========================================
                // 1. BUTTON INTERRUPTS
                // ==========================================
                if (interaction.isButton()) {
                    const handler = handlers.find(
                        h => h.type === 'button' && this.matchCustomId(h.match, interaction.customId)
                    );
                    if (handler) return await handler.execute(interaction, this.client);
                }

                // ==========================================
                // 2. MODAL SUBMIT INTERRUPTS
                // ==========================================
                if (interaction.isModalSubmit()) {
                    const handler = handlers.find(
                        h => h.type === 'modal' && this.matchCustomId(h.match, interaction.customId)
                    );
                    if (handler) return await handler.execute(interaction, this.client);
                    Syslog.info('irq_controller', `Unhandled modal submission: ${interaction.customId}`);
                }

                // ==========================================
                // 3. SLASH COMMAND DISPATCH (Registry-Based)
                // ==========================================
                if (interaction.isChatInputCommand()) {
                    const cmd = this.commands.get(interaction.commandName);
                    if (cmd) {
                        Syslog.info('irq_controller', `Executing /${interaction.commandName}`);
                        return await cmd.execute(interaction);
                    }
                    Syslog.warn('irq_controller', `Unrecognized command interrupt: /${interaction.commandName}`);
                }

            } catch (error) {
                Syslog.error('irq_controller', `Interrupt failure on interaction ${interaction.id}`, error);

                if (interaction.isRepliable()) {
                    const payload = {
                        content: '❌ **CRITICAL ERROR:** The Interaction Pipeline encountered an unhandled exception.',
                        flags: [MessageFlags.Ephemeral],
                    };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(payload).catch(() => {});
                    } else {
                        await interaction.reply(payload).catch(() => {});
                    }
                }
            }
        });
    }

    /**
     * Resolves whether a customId matches a handler's declared match pattern.
     * String = exact match. RegExp = pattern test.
     */
    private matchCustomId(match: string | RegExp, customId: string): boolean {
        if (match instanceof RegExp) return match.test(customId);
        return customId === match;
    }

    /**
     * Main boot sequence: Storage → Modules → Network → Ready.
     */
    public async boot() {
        try {
            console.clear();
            Syslog.info('kernel', '--- STARTING SYSTEM ---');

            // 1. Initialize Storage Controller
            await connectDatabase();

            // 2. Mount all module limbs into the kernel
            await this.mountModules();

            // 3. Post-Boot Hook (Ready Event)
            this.client.once(Events.ClientReady, async (c) => {
                Syslog.init(this.client);
                Syslog.success('kernel', `TasDyn AI Online. Authenticated as ${c.user.tag}`);

                // Run every onReady hook declared by each module in order
                for (const mod of this.modules) {
                    for (const hook of mod.onReady ?? []) {
                        await hook(this.client);
                    }
                }

                // Mirror terminal output to Discord logs
                Syslog.interceptConsole();
                Syslog.info('kernel', 'Boot sequence complete. System operational.');
            });

            // 4. Authenticate with Discord
            await this.client.login(process.env.DISCORD_CORE_TOKEN);

        } catch (error) {
            Syslog.error('kernel', 'KERNEL PANIC: Boot sequence interrupted.', error);
            process.exit(1);
        }
    }
}