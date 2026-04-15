import { Client, Events, Interaction, MessageFlags } from 'discord.js';
import { Syslog } from '../core/syslog';

// Internal Logic Imports
import { handleVerification } from './iam/gatekeeper';
// import { handleModals } from './iam/modalHandler'; // Enable when you move your modalHandler.ts here

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
                // These IDs are generated in syslog.ts (e.g., mod_mute_ID)
                if (customId.startsWith('mod_')) {
                    const action = customId.split('_')[1]; // mute, kick, ban
                    const targetId = customId.split('_')[2];
                    
                    Syslog.info('mod_action', `Moderator initiated ${action} on target: ${targetId}`);
                    
                    // Route to your moderation logic (placeholder)
                    // return await handleModerationAction(interaction, action, targetId);
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
                Syslog.info('irq_controller', `Modal submission received: ${customId}`);

                // Route to your specific modal handler logic
                // return await handleModals(interaction, client);
                
                // Temporary feedback until modal logic is fully mounted
                return await interaction.reply({ 
                    content: '✅ Data received by the network. Processing...', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // ==========================================
            // 3. SLASH COMMAND INTERRUPTS
            // ==========================================
            if (interaction.isChatInputCommand()) {
                const { commandName } = interaction;
                Syslog.info('irq_controller', `Slash command invoked: /${commandName}`);

                // Future command router logic:
                // const command = client.commands.get(commandName);
                // if (command) await command.execute(interaction);
            }

        } catch (error) {
            // Critical Exception Handling
            Syslog.error('irq_controller', `Interrupt Failure: ${interaction.id}`, error);

            if (interaction.isRepliable()) {
                const errorPayload = { 
                    content: '❌ **CRITICAL ERROR:** An unhandled exception occurred in the Interaction Pipeline.', 
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