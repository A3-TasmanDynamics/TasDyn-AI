import { Client, ChatInputCommandInteraction, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';

export interface CommandModule {
    data: SlashCommandBuilder | any;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Declares a handler for a specific button, modal, or select-menu interaction.
 * Use a string for exact customId match, or a RegExp for pattern matching.
 */
export interface InteractionHandler {
    match: string | RegExp;
    type: 'button' | 'modal' | 'select';
    execute: (interaction: any, client: Client) => Promise<void>;
}

/**
 * A self-describing module manifest.
 * The Kernel reads these configs to wire everything up — the module itself
 * never needs to know about the Kernel internals.
 */
export interface ModuleConfig {
    /** Unique identifier shown in logs */
    name: string;
    /** Human-readable description of the module's purpose */
    description: string;
    /** Additional Discord gateway intents this module requires */
    intents?: GatewayIntentBits[];
    /** Slash commands exposed by this module */
    commands?: CommandModule[];
    /** Event listeners to mount on the client (called before login) */
    events?: Array<(client: Client) => void>;
    /** Async hooks called once the client is Ready */
    onReady?: Array<(client: Client) => Promise<void>>;
    /** Button / modal / select-menu interaction handlers */
    interactions?: InteractionHandler[];
}