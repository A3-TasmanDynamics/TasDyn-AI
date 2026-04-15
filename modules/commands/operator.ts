import { SlashCommandBuilder, EmbedBuilder, GuildMember, MessageFlags } from 'discord.js';
import { CommandModule } from '../../core/types';
import { db } from '../../core/database';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';

export const OperatorCommand: CommandModule = {
    data: new SlashCommandBuilder()
        .setName('operator')
        .setDescription('Access the tactical dossier of a network operator.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Select the operator to investigate')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const member = interaction.options.getMember('target') as GuildMember || interaction.member as GuildMember;

        try {
            const userData = db.prepare("SELECT * FROM users WHERE discordId = ?").get(targetUser.id) as any;
            const accountAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
            
            let clearance = 'LEVEL_0 // RESTRICTED';
            if (targetUser.id === interaction.guild?.ownerId) clearance = 'LEVEL_5 // ADMINISTRATOR';
            else if (member.roles.cache.has(Config.discord.roles.staff!)) clearance = 'LEVEL_4 // STAFF_OVERWATCH';
            else if (member.roles.cache.has(Config.discord.roles.user!)) clearance = 'LEVEL_1 // VERIFIED_OPERATOR';

            const embed = new EmbedBuilder()
                .setAuthor({ name: `TASDYN_INTERNAL // DOSSIER: ${targetUser.username.toUpperCase()}`, iconURL: targetUser.displayAvatarURL() })
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor(userData?.status === 'verified' ? 0x2ECC71 : 0xF1C40F)
                .addFields(
                    { name: '📡 NETWORK_STATUS', value: `\`${userData?.status?.toUpperCase() || 'UNREGISTERED'}\``, inline: true },
                    { name: '🛡️ CLEARANCE', value: `\`${clearance}\``, inline: true },
                    { name: '🆔 SYSTEM_UID', value: `\`${targetUser.id}\``, inline: false },
                    { name: '📅 NETWORK_ENTRY', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : '`N/A`', inline: true },
                    { name: '🎂 ACCOUNT_AGE', value: `\`${accountAgeDays} Days\``, inline: true }
                )
                .setFooter({ text: `DATA_RETRIEVAL_BY: ${interaction.user.tag.toUpperCase()}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            Syslog.error('iam_operator', `Dossier retrieval failed for ${targetUser.id}`, error);
            await interaction.reply({ content: '❌ **CRITICAL_ERROR:** Database access denied.', flags: [MessageFlags.Ephemeral] });
        }
    }
};