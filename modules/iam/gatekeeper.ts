import { ButtonInteraction, Client, GuildMember, MessageFlags } from 'discord.js';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';
import { db } from '../../core/database';

export const handleVerification = async (interaction: ButtonInteraction, client: Client) => {
    try {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const member = interaction.member as GuildMember;
        const userRoleId = Config.discord.roles.user;
        const userRole = interaction.guild?.roles.cache.get(userRoleId!);
        
        if (!userRole) {
            Syslog.error('gatekeeper', 'User Role ID not found in Guild Cache.');
            return interaction.editReply({ content: '❌ **SYSTEM ERROR:** Verification role not found.' });
        }

        if (member.roles.cache.has(userRole.id)) {
            return interaction.editReply({ content: 'ℹ️ **STATUS:** Identity already verified.' });
        }

        // 1. Role Assignment
        await member.roles.add(userRole);

        // 2. Storage Update
        db.prepare("UPDATE users SET status = 'verified', updatedAt = CURRENT_TIMESTAMP WHERE discordId = ?")
          .run(member.id);

        await interaction.editReply({ content: '✅ **IDENTITY VERIFIED.** Welcome to the Tasman Dynamics network.' });
        
        // 3. Audit Log
        if (Config.discord.channels.audit) {
            Syslog.discordLog(client, Config.discord.channels.audit, {
                category: 'AUTH',
                action: 'LOGIN',
                severity: 'info',
                actorType: 'user',
                actorId: member.id,
                actorUsername: member.user.tag,
                description: `Operator verified via Security Gate. Role Assigned: ${userRole.name}`,
                source: 'discord',
                status: 'success'
            });
        }

    } catch (error) {
        Syslog.error('gatekeeper', 'Auth sequence failed', error);
        await interaction.editReply({ content: '❌ Verification sequence failed. Please retry.' });
    }
};