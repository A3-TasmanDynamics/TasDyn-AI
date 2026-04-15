import { Client, Events, Interaction, MessageFlags } from 'discord.js';
import { Syslog } from '../core/syslog';

// Logic Imports
import { handleVerification } from './iam/gatekeeper';
import { handleBroadcastCommand } from './broadcast/broadcastCommand';
import { handleBroadcastModalSubmit } from './broadcast/modalHandler';

/**
 * Interaction Interrupt Controller (IRQ)
 * Routes all Discord interactions to their respective service modules.
 */
export const mountInteractionManager = (client: Client) => {
    Syslog.info('irq_controller', 'Mounting Interaction Interrupt Controller...');

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        try {
            // ==========================================
            // 1. BUTTON INTERRUPTS
            // ==========================================
            if (interaction.isButton()) {
                const { customId } = interaction;

                // --- IAM / GATEKEEPER ---
                if (customId === 'gatekeeper_verify') {
                    return await handleVerification(interaction, client);
                }

                // --- SYSLOG MODERATION ACTIONS ---
                if (customId.startsWith('mod_')) {
                    const action = customId.split('_')[1]; 
                    const targetId = customId.split('_')[2];
                    
                    Syslog.info('mod_action', `Moderator initiated ${action} on target: ${targetId}`);
                    
                    return await interaction.reply({ 
                        content: `⚠️ Action **${action.toUpperCase()}** received for UID: \`${targetId}\`. Execution module pending.`, 
                        flags: [MessageFlags.Ephemeral] 
                    });
                }
            }

            // ==========================================
            // 2. MODAL SUBMISSION INTERRUPTS
            // ==========================================
            if (interaction.isModalSubmit()) {
                const { customId } = interaction;

                // --- BROADCAST DISPATCH ---
                if (customId.startsWith('modal_broadcast_')) {
                    return await handleBroadcastModalSubmit(interaction, client);
                }
                
                Syslog.info('irq_controller', `Unknown modal submission received: ${customId}`);
            }

            // ==========================================
            // 3. SLASH COMMAND INTERRUPTS
            // ==========================================
            if (interaction.isChatInputCommand()) {
                const { commandName } = interaction;

                // --- BROADCAST INITIALIZATION ---
                if (commandName === 'broadcast') {
                    return await handleBroadcastCommand(interaction);
                }

                Syslog.info('irq_controller', `Slash command invoked: /${commandName}`);
            }

        } catch (error) {
            // Critical Exception Handling for the entire pipeline
            Syslog.error('irq_controller', `Interrupt Failure in ${interaction.id}`, error);

            if (interaction.isRepliable()) {
                const errorPayload = { 
                    content: '❌ **CRITICAL ERROR:** The Interaction Pipeline encountered an unhandled exception.', 
                    flags: [MessageFlags.Ephemeral] 
                };

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorPayload).catch(() => {});
                } else {
                    await interaction.reply(errorPayload).catch(() => {});
                }
            }
        }
    });
};