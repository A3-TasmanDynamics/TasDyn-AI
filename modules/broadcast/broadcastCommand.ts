import { 
    ChatInputCommandInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ModalActionRowComponentBuilder 
} from 'discord.js';

export const handleBroadcastCommand = async (interaction: ChatInputCommandInteraction) => {
    const targetChannel = interaction.options.getChannel('channel');

    const modal = new ModalBuilder()
        .setCustomId(`modal_broadcast_${targetChannel?.id}`)
        .setTitle('TasDyn | Broadcast Dispatch');

    const titleInput = new TextInputBuilder()
        .setCustomId('broadcast_title')
        .setLabel('Announcement Title')
        .setPlaceholder('Enter a clear, concise heading...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('broadcast_content')
        .setLabel('Message Content')
        .setPlaceholder('Markdown is supported. Use \\n for line breaks.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('broadcast_image')
        .setLabel('Image URL (Optional)')
        .setPlaceholder('https://...')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(contentInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
};