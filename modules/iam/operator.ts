import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags } from 'discord.js';
import { db } from '../../core/database';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';

export const handleOperatorCommand = async (interaction: ChatInputCommandInteraction) => {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = interaction.options.getMember('target') as GuildMember || interaction.member as GuildMember;

    try {
        // 1. Database Retrieval
        const userData = db.prepare("SELECT * FROM users WHERE discordId = ?").get(targetUser.id) as any;

        // 2. Metadata & Time Processing
        const accountAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
        const joinedTimestamp = member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;
        const createdTimestamp = Math.floor(targetUser.createdTimestamp / 1000);

        // 3. Clearance Level Resolution
        let clearance = 'LEVEL_0 // RESTRICTED';
        const roles = member.roles.cache;

        if (targetUser.id === interaction.guild?.ownerId) {
            clearance = 'LEVEL_5 // ADMINISTRATOR';
        } else if (roles.has(Config.discord.roles.staff!)) {
            clearance = 'LEVEL_4 // STAFF_OVERWATCH';
        } else if (roles.has(Config.discord.roles.user!)) {
            clearance = 'LEVEL_1 // VERIFIED_OPERATOR';
        }

        // 4. Constructing the Tactical Dossier
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: `TASDYN_INTERNAL // DOSSIER: ${targetUser.username.toUpperCase()}`, 
                iconURL: targetUser.displayAvatarURL() 
            })
            .setThumbnail(targetUser.displayAvatarURL())
            .setColor(userData?.status === 'verified' ? 0x2ECC71 : 0xF1C40F)
            .addFields(
                { name: '📡 NETWORK_STATUS', value: `\`${userData?.status?.toUpperCase() || 'UNREGISTERED'}\``, inline: true },
                { name: '🛡️ CLEARANCE', value: `\`${clearance}\``, inline: true },
                { name: '🆔 SYSTEM_UID', value: `\`${targetUser.id}\``, inline: false },
                { name: '📅 NETWORK_ENTRY', value: joinedTimestamp ? `<t:${joinedTimestamp}:D>` : '`N/A`', inline: true },
                { name: '🎂 ACCOUNT_AGE', value: `\`${accountAgeDays} Days\``, inline: true },
                { name: '🕒 LAST_SYNC', value: userData?.updatedAt ? `<t:${Math.floor(new Date(userData.updatedAt).getTime() / 1000)}:R>` : '`Never`', inline: true }
            )
            .setFooter({ text: `DATA_RETRIEVAL_BY: ${interaction.user.tag.toUpperCase()}` })
            .setTimestamp();

        // 5. Staff Intelligence (Show Message Ref if Administrator/Staff)
        if (userData?.welcomeMessageId && interaction.memberPermissions?.has('Administrator')) {
            embed.addFields({ name: '💾 CACHED_REF', value: `\`${userData.welcomeMessageId}\``, inline: false });
        }

        return await interaction.reply({ embeds: [embed] });

    } catch (error) {
        Syslog.error('iam_operator', `Dossier retrieval failed for UID: ${targetUser.id}`, error);
        return await interaction.reply({ 
            content: '❌ **CRITICAL_ERROR:** Tactical database access denied or record corrupted.', 
            flags: [MessageFlags.Ephemeral] 
        });
    }
};