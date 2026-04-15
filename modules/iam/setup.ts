import { 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Client 
} from 'discord.js';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';

export const deploySecurityGate = async (client: Client) => {
    try {
        const channelId = Config.discord.channels.gatekeeper;
        const channel = await client.channels.fetch(channelId!) as TextChannel;

        if (!channel) {
            return Syslog.error('iam_setup', `Gate-keeper channel not found (ID: ${channelId})`);
        }

        // --- 1. PURGE PROTOCOL ---
        // Fetch the last 50 messages to ensure we find any old gates
        const messages = await channel.messages.fetch({ limit: 50 });
        
        // Filter for messages sent by this bot that aren't pinned
        const oldGates = messages.filter(m => m.author.id === client.user?.id && !m.pinned);

        if (oldGates.size > 0) {
            Syslog.info('iam_setup', `Purging ${oldGates.size} legacy security gates...`);
            await channel.bulkDelete(oldGates).catch(err => {
                Syslog.error('iam_setup', 'Bulk delete failed (messages may be > 14 days old). Falling back to manual deletion.', err);
                // Fallback: Delete one by one if they are too old for bulkDelete
                oldGates.forEach(m => m.delete().catch(() => {}));
            });
        }

        // --- 2. DEPLOY FRESH GATE ---
        const embed = new EmbedBuilder()
            .setTitle('🔒 TASMAN DYNAMICS | SECURITY GATE')
            .setDescription(
                `**Authorized Personnel Only**\n\n` +
                `To prevent unauthorized automated access, please verify your identity below.\n\n` +
                `By verifying, you agree to the server rules.`
            )
            .setColor(0x2B2D31);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('gatekeeper_verify')
                .setLabel('Verify Identity')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
        Syslog.success('iam_setup', 'Fresh Security Gate deployed to the network.');
        
    } catch (error) {
        Syslog.error('iam_setup', 'Failed to cycle Security Gate.', error);
    }
};