import { ModalSubmitInteraction, Client, MessageFlags } from 'discord.js';
import { BroadcastService } from './broadcastService';
import { Syslog } from '../../core/syslog';

export const handleBroadcastModalSubmit = async (interaction: ModalSubmitInteraction, client: Client) => {
    // Extract channel ID from the customId we set in the command
    const channelId = interaction.customId.split('_')[2];
    
    const title = interaction.fields.getTextInputValue('broadcast_title');
    const content = interaction.fields.getTextInputValue('broadcast_content');
    const imageUrl = interaction.fields.getTextInputValue('broadcast_image');

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const result = await BroadcastService.send(client, {
        channelId,
        title,
        content,
        imageUrl: imageUrl || undefined
    });

    if (result.success) {
        await interaction.editReply({ content: `✅ **DISPATCH SUCCESS:** Announcement live in <#${channelId}>.` });
    } else {
        await interaction.editReply({ content: `❌ **DISPATCH FAILED:** Check system logs for details.` });
    }
};