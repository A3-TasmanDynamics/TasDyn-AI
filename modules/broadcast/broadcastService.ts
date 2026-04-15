import { Client, TextChannel, EmbedBuilder, ColorResolvable } from 'discord.js';
import { Syslog } from '../../core/syslog';

export interface BroadcastPayload {
    channelId: string;
    title: string;
    content: string;
    imageUrl?: string;
    color?: string;
    footer?: string;
}

export const BroadcastService = {
    /**
     * Dispatches a formatted announcement to a specific network node (channel).
     */
    async send(client: Client, data: BroadcastPayload) {
        try {
            const channel = await client.channels.fetch(data.channelId) as TextChannel;
            if (!channel) throw new Error(`Target channel ${data.channelId} not found.`);

            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setDescription(data.content.replace(/\\n/g, '\n'))
                .setColor((data.color as ColorResolvable) || 0x2B2D31)
                .setTimestamp();

            if (data.imageUrl) embed.setImage(data.imageUrl);
            if (data.footer) embed.setFooter({ text: data.footer });

            const message = await channel.send({ embeds: [embed] });
            
            Syslog.success('broadcast', `Announcement dispatched to #${channel.name} (${message.id})`);
            return { success: true, messageId: message.id };
        } catch (error) {
            Syslog.error('broadcast', 'Dispatch failure.', error);
            return { success: false, error };
        }
    }
};