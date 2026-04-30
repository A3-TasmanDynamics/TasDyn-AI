import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandModule } from '../../core/types';
import { handleBroadcastCommand } from '../broadcast/broadcastCommand';

export const BroadcastCommand: CommandModule = {
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Dispatch an announcement to a target channel.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Target channel for the broadcast')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),

    execute: handleBroadcastCommand,
};
