import { GatewayIntentBits, MessageFlags, TextChannel } from 'discord.js';
import { ModuleConfig } from '../../core/types';
import { Syslog } from '../../core/syslog';
import { mountMemberEvents } from './memberEvents';
import { deploySecurityGate } from './setup';
import { handleVerification } from './gatekeeper';

const IAMModule: ModuleConfig = {
    name: 'iam',
    description: 'Identity & Access Management — member lifecycle events, security gate deployment, and moderation actions.',

    // Requires GuildMembers so the client receives join/leave events
    intents: [GatewayIntentBits.GuildMembers],

    events: [mountMemberEvents],

    onReady: [deploySecurityGate],

    interactions: [
        // Security gate verification button
        {
            match: 'gatekeeper_verify',
            type: 'button',
            execute: (interaction, client) => handleVerification(interaction, client),
        },

        // Syslog moderation action buttons (mod_<action>_<targetId>)
        {
            match: /^mod_/,
            type: 'button',
            execute: async (interaction) => {
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const targetId = parts[2];
                Syslog.info('mod_action', `Moderator initiated ${action} on target: ${targetId}`);
                await interaction.reply({
                    content: `⚠️ Action **${action.toUpperCase()}** received for UID: \`${targetId}\`. Execution module pending.`,
                    flags: [MessageFlags.Ephemeral],
                });
            },
        },
    ],
};

export default IAMModule;
