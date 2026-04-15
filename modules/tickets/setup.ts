import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Config } from '../../core/config';

export const deploySupportHub = async (client: Client) => {
    try {
        const channel = await client.channels.fetch(Config.discord.channels.support) as TextChannel;
        if (!channel) return;

        // Clean slate for the support hub
        await channel.bulkDelete(100).catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('TASDYN_NETWORK // SUPPORT_HUB')
            .setColor(0x3498DB)
            .setDescription(
                'Access to the Tasman Dynamics tactical support grid.\n\n' +
                'Click the button below to initialize a private, encrypted support session. ' +
                'Staff overwatch will be notified upon channel generation.'
            )
            .setFooter({ text: 'System Status: Nominal' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_open_prompt')
                .setLabel('Initialize Ticket')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {
        console.error('Support Hub Deployment Failed:', e);
    }
};