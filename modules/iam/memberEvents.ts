import { Client, Events, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { Syslog } from '../../core/syslog';
import { Config } from '../../core/config';
import { db } from '../../core/database';

export const mountMemberEvents = (client: Client) => {
    Syslog.info('iam', 'Mounting Member Lifecycle Events...');

    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
        // 1. Storage Sync
        try {
            const upsert = db.prepare(`
                INSERT INTO users (discordId, username, status) 
                VALUES (?, ?, 'pending')
                ON CONFLICT(discordId) DO UPDATE SET status = 'pending', updatedAt = CURRENT_TIMESTAMP
            `);
            upsert.run(member.id, member.user.username);
        } catch (e) { Syslog.error('iam_sync', 'Sync Failure', e); }

        // 2. Identification Prompt (Amber Embed)
        try {
            const channelId = Config.discord.channels.welcome;
            const channel = member.guild.channels.cache.get(channelId!) as TextChannel;
            
            if (channel) {
                const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
                
                const embed = new EmbedBuilder()
                    .setColor(0xF59E0B) // Amber
                    .setTitle('Identification Required')
                    .setDescription(
                        `Welcome to **Tasman Dynamics**, <@${member.id}>.\n\n` +
                        `Your entry is currently **PENDING**.\n` +
                        `Please proceed to <#${Config.discord.channels.gatekeeper}> and confirm your identity to gain access.`
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ text: `Account Age: ${accountAgeDays} Days` });

                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            Syslog.error('iam_welcome', 'Welcome prompt failed', error);
        }
    });
};