import { Events, Interaction, MessageFlags, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { Syslog } from '../core/syslog';
import { Kernel } from '../core/kernel';

// Logic Imports
import { handleVerification } from './iam/gatekeeper';
import { handleBroadcastCommand } from './broadcast/broadcastCommand';
import { handleBroadcastModalSubmit } from './broadcast/modalHandler';
import { TicketService } from './tickets/ticketService';

/**
 * Interaction Interrupt Controller (IRQ)
 * Routes all Discord interactions to their respective service modules.
 */
export const mountInteractionManager = (kernel: Kernel) => {
    Syslog.info('irq_controller', 'Mounting Interaction Interrupt Controller...');

    kernel.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        try {
            // ==========================================
            // 1. BUTTON INTERRUPTS
            // ==========================================
            if (interaction.isButton()) {
                const { customId } = interaction;

                // --- IAM / GATEKEEPER ---
                if (customId === 'gatekeeper_verify') {
                    return await handleVerification(interaction, kernel.client);
                }

                // --- TICKET SYSTEM: OPEN PROMPT ---
                if (customId === 'ticket_open_prompt') {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_ticket_create')
                        .setTitle('TICKET_INIT // SUPPORT_REQUEST');

                    const subjectInput = new TextInputBuilder()
                        .setCustomId('ticket_subject')
                        .setLabel('Subject / Tactical Incident')
                        .setPlaceholder('Provide a brief summary of the issue...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput));
                    return await interaction.showModal(modal);
                }

                // --- TICKET SYSTEM: CLOSE & ARCHIVE ---
                if (customId.startsWith('ticket_close_')) {
                    return await TicketService.closeTicket(interaction.channel as TextChannel, interaction.user.id);
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
                    return await handleBroadcastModalSubmit(interaction, kernel.client);
                }

                // --- TICKET SYSTEM: CREATION --- 
                if (customId === 'modal_ticket_create') {
                    const subject = interaction.fields.getTextInputValue('ticket_subject');
                    await TicketService.createTicket(kernel.client, interaction.user.id, subject, interaction.guildId!);
                    return await interaction.reply({ content: '✅ **TICKET_INIT_SUCCESS.** Channel generated in the support category.', flags: [MessageFlags.Ephemeral] });
                }
                
                Syslog.info('irq_controller', `Unknown modal submission received: ${customId}`);
            }

            // ==========================================
            // 3. MODULAR SLASH COMMANDS (Registry-Based)
            // ==========================================
            if (interaction.isChatInputCommand()) {
                const { commandName } = interaction;

                // First, check the modular registry in the Kernel
                const modularCommand = kernel.commands.get(commandName);

                if (modularCommand) {
                    Syslog.info('irq_controller', `Executing modular command: /${commandName}`);
                    return await modularCommand.execute(interaction);
                }

                // Fallback for legacy hardcoded commands (like Broadcast)
                if (commandName === 'broadcast') {
                    return await handleBroadcastCommand(interaction);
                }

                Syslog.warn('irq_controller', `Unrecognized command interrupt: /${commandName}`);
            }

        } catch (error) {
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