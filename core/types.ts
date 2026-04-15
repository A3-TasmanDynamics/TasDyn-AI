import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface CommandModule {
    data: SlashCommandBuilder | any;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}