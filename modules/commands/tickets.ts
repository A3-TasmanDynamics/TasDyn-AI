import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { CommandModule } from '../../core/types';
import { TicketService } from '../tickets/ticketService';

export const TicketCommand: CommandModule = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Initialize a tactical support session.')
        .addStringOption(option => 
            option.setName('subject')
                .setDescription('Briefly describe the issue (Optional: skips the modal)')
                .setRequired(false)),

    async execute(interaction) {
        const subject = interaction.options.getString('subject');

        if (subject) {
            // Logic: Immediate creation if subject is provided via slash argument
            await TicketService.createTicket(interaction.client, interaction.user.id, subject, interaction.guildId!);
            return await interaction.reply({ 
                content: '✅ **TICKET_INIT_SUCCESS.** Encrypted channel generated in the support category.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Logic: Launch the standard UI modal if no subject is provided
        const modal = new ModalBuilder()
            .setCustomId('modal_ticket_create')
            .setTitle('TICKET_INIT // SUPPORT');

        const input = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Subject / Incident')
            .setPlaceholder('Describe the issue briefly...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return await interaction.showModal(modal);
    }
};