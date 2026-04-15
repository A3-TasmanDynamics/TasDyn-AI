import { 
    ButtonInteraction, 
    Client, 
    GuildMember, 
    MessageFlags, 
    TextChannel, 
    EmbedBuilder 
} from 'discord.js';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';
import { db } from '../../core/database';

/**
 * Handle Gatekeeper Verification
 * Assigns roles, updates database, and flips the welcome embed state.
 */
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
        
        // 3. Welcome Embed Flip (Amber -> Green)
        try {
            const record = db.prepare("SELECT welcomeMessageId FROM users WHERE discordId = ?")
                            .get(member.id) as { welcomeMessageId: string | null } | undefined;

            if (record?.welcomeMessageId) {
                // Resolved: Updated to securitygates to match lifecycle events
                const welcomeChannelId = Config.discord.channels.securitygates;
                
                const channel = await client.channels.fetch(welcomeChannelId!) as TextChannel;
                const message = await channel.messages.fetch(record.welcomeMessageId);

                if (message) {
                    const verifiedEmbed = new EmbedBuilder()
                        .setColor(0x2ECC71) // TasDyn Green
                        .setTitle('✅ Operator Verified')
                        .setThumbnail(member.user.displayAvatarURL())
                        .setDescription(
                            `Operator <@${member.id}> has been successfully authenticated.\n\n` +
                            `**Clearance Level:** ${userRole.name}\n` +
                            `**Network Status:** Active`
                        )
                        .setFooter({ text: `Authenticated at ${new Date().toLocaleTimeString()}` });

                    await message.edit({ embeds: [verifiedEmbed] });
                    
                    Syslog.success('gatekeeper', `Embed state updated to VERIFIED for ${member.user.tag}`, 'USER');
                }
            }
        } catch (flipError) {
            // We log this but don't fail the interaction, as the role was already given
            Syslog.warn('gatekeeper', `Failed to flip welcome embed for ${member.user.tag}. Reference: ${record?.welcomeMessageId}`);
        }

        // 4. Audit Log (Category: AUTH)
        const logChannel = Config.discord.channels.iam_logs;
        if (logChannel) {
            Syslog.discordLog(client, logChannel, {
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