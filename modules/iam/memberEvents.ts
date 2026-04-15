import { Client, Events, GuildMember, PartialGuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { Syslog } from '../../core/syslog';
import { Config } from '../../core/config';
import { db } from '../../core/database';

export const mountMemberEvents = (client: Client) => {
    Syslog.info('iam', 'Mounting Member Lifecycle Events...');

    // ==========================================
    // 1. JOIN EVENT (Entry & Identification)
    // ==========================================
    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
        console.log(`[NETWORK_JOIN] Operator detected: ${member.user.tag}`);

        // A. Storage Sync (Initial Record)
        try {
            const upsert = db.prepare(`
                INSERT INTO users (discordId, username, status) 
                VALUES (?, ?, 'pending')
                ON CONFLICT(discordId) DO UPDATE SET status = 'pending', updatedAt = CURRENT_TIMESTAMP
            `);
            upsert.run(member.id, member.user.username);
        } catch (e) { 
            Syslog.error('iam_sync', 'Database write failure during join.', e); 
        }

        // B. Systematic Audit Log
        const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
        const riskPrefix = accountAgeDays < 30 ? '[HIGH RISK] ' : '';
        Syslog.info('iam', `${riskPrefix}Operator ${member.user.tag} joined. Account Age: ${accountAgeDays} days.`, 'USER');

        // C. Welcome Presentation & ID Capture
        try {
            const securityGatesId = Config.discord.channels.securitygates;
            
            // Perform an async fetch to prevent cache-miss failures
            const channel = await client.channels.fetch(securityGatesId!) as TextChannel;
            
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(accountAgeDays < 30 ? 0xff0000 : 0xF59E0B)
                    .setTitle('Identification Required')
                    .setDescription(
                        `Welcome to **Tasman Dynamics**, <@${member.id}>.\n\n` +
                        `Your network entry is currently **PENDING**.\n` +
                        `Please proceed to <#${Config.discord.channels.gatekeeper}> to verify your identity.`
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ text: `System UID: ${member.id} | Age: ${accountAgeDays} Days` });

                // Dispatch and capture message object
                const sentMessage = await channel.send({ embeds: [embed] });

                // Store the Message ID for the gatekeeper "flip"
                db.prepare("UPDATE users SET welcomeMessageId = ? WHERE discordId = ?")
                  .run(sentMessage.id, member.id);
                  
                Syslog.info('iam', `Welcome embed dispatched to #${channel.name}. ID ${sentMessage.id} cached.`, 'USER');
            }
        } catch (error) {
            Syslog.error('iam_welcome', 'Failed to dispatch or cache welcome embed.', error);
        }
    });

    // ==========================================
    // 2. LEAVE EVENT (Disconnect & Deactivation)
    // ==========================================
    client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
        console.log(`[NETWORK_LEAVE] Operator disconnected: ${member.user?.tag || 'Unknown'}`);

        try {
            db.prepare("UPDATE users SET status = 'inactive', updatedAt = CURRENT_TIMESTAMP WHERE discordId = ?")
              .run(member.id);
        } catch (e) { 
            Syslog.error('iam_sync', 'Database update failure during leave.', e); 
        }

        Syslog.info('iam', `Operator ${member.user?.tag || 'Unknown'} disconnected.`, 'USER');

        try {
            const securityGatesId = Config.discord.channels.securitygates;
            const channel = await client.channels.fetch(securityGatesId!) as TextChannel;
            
            if (channel) {
                await channel.send(`**[DISCONNECTED]** Operator **${member.user?.tag || 'Unknown'}** has left the server.`);
            }
        } catch (error) {
            Syslog.error('iam_leave', 'Failed to dispatch leave notification.', error);
        }
    });
};