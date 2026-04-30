import { ActionRowBuilder, MessageFlags, ModalBuilder, TextChannel, TextInputBuilder, TextInputStyle } from 'discord.js';
import { ModuleConfig } from '../../core/types';
import { TicketCommand } from '../commands/tickets';
import { deploySupportHub } from './setup';
import { TicketService } from './ticketService';

const TicketsModule: ModuleConfig = {
    name: 'tickets',
    description: 'Support ticket system — channel creation, management, and closure.',

    commands: [TicketCommand],

    onReady: [deploySupportHub],

    interactions: [
        // "Initialize Ticket" button — shows the creation modal
        {
            match: 'ticket_open_prompt',
            type: 'button',
            execute: async (interaction) => {
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
                await interaction.showModal(modal);
            },
        },

        // Ticket close button (customId format: ticket_close_<channelId>)
        {
            match: /^ticket_close_/,
            type: 'button',
            execute: (interaction, client) =>
                TicketService.closeTicket(interaction.channel as TextChannel, interaction.user.id),
        },

        // Ticket creation modal submission
        {
            match: 'modal_ticket_create',
            type: 'modal',
            execute: async (interaction, client) => {
                const subject = interaction.fields.getTextInputValue('ticket_subject');
                await TicketService.createTicket(client, interaction.user.id, subject, interaction.guildId!);
                await interaction.reply({
                    content: '✅ **TICKET_INIT_SUCCESS.** Encrypted channel generated in the support category.',
                    flags: [MessageFlags.Ephemeral],
                });
            },
        },
    ],
};

export default TicketsModule;
