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
            return Syslog.error('iam_setup', `Could not find gate-keeper channel with ID: ${channelId}`);
        }

        // 1. Build the Security Gate Embed
        const embed = new EmbedBuilder()
            .setTitle('🔒 TASMAN DYNAMICS | SECURITY GATE')
            .setDescription(
                `**Authorized Personnel Only**\n\n` +
                `To prevent unauthorized automated access, please verify your identity below.\n\n` +
                `By verifying, you agree to the server rules.`
            )
            .setImage('https://i.imgur.com/your-gate-image.png') // Replace with a TasDyn graphic if you have one
            .setColor(0x2B2D31);

        // 2. Create the Interrupt Button
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('gatekeeper_verify') // MUST match your InteractionManager check
                .setLabel('Verify Identity')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Success)
        );

        // 3. Post to the Channel
        await channel.send({ embeds: [embed], components: [row] });
        
        Syslog.success('iam_setup', 'Security Gate has been deployed to the network.');
    } catch (error) {
        Syslog.error('iam_setup', 'Critical failure during Security Gate deployment.', error);
    }
};