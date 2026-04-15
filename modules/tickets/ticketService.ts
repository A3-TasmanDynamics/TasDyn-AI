import { 
    Client, TextChannel, ChannelType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder 
} from 'discord.js';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';
import { db } from '../../core/database';

export class TicketService {
    static async createTicket(client: Client, userId: string, subject: string, guildId: string) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // 1. Generate Tactical Channel with Bot Access
        const channel = await guild.channels.create({
            name: `ticket-${userId.substring(0, 5)}`,
            type: ChannelType.GuildText,
            parent: Config.discord.categories.tickets,
            permissionOverwrites: [
                // Deny @everyone
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },

                // ALLOW THE BOT (Crucial Fix)
                { 
                    id: client.user!.id, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages, 
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ManageChannels // Required for the bot to delete it later
                    ] 
                },

                // Allow the Operator
                { 
                    id: userId, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages, 
                        PermissionFlagsBits.EmbedLinks, 
                        PermissionFlagsBits.AttachFiles
                    ] 
                },

                // Allow Staff
                { 
                    id: Config.discord.roles.staff!, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages
                    ] 
                }
            ]
        });

        // 2. Sync to DB
        db.prepare("INSERT INTO tickets (channelId, creatorId, subject) VALUES (?, ?, ?)")
          .run(channel.id, userId, subject);

        // 3. Dispatch Channel UI
        const embed = new EmbedBuilder()
            .setTitle('🎫 SUPPORT_SESSION // ENCRYPTED')
            .setColor(0x3498DB)
            .setDescription(`**Operator:** <@${userId}>\n**Subject:** \`${subject}\`\n\nStaff overwatch has been alerted. Please provide your data below.`)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel('Close & Archive').setStyle(ButtonStyle.Danger)
        );

        // Now the bot has access to send this
        await channel.send({ 
            content: `<@&${Config.discord.roles.staff}> | Signal received from <@${userId}>`, 
            embeds: [embed], 
            components: [row] 
        });

        Syslog.info('tickets', `Channel ${channel.name} created for UID: ${userId}`, 'TICKET');
    }

    static async closeTicket(channel: TextChannel, closerId: string) {
        try {
            // 1. Compile JSON Transcript
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = {
                metadata: {
                    channelId: channel.id,
                    closedBy: closerId,
                    closedAt: new Date().toISOString(),
                },
                logs: Array.from(messages.values()).reverse().map(m => ({
                    user: m.author.tag,
                    content: m.content,
                    timestamp: m.createdAt.toISOString(),
                    assets: Array.from(m.attachments.values()).map(a => a.url)
                }))
            };

            const jsonBuffer = Buffer.from(JSON.stringify(transcript, null, 4));

            // 2. Archive to DB
            db.prepare("UPDATE tickets SET status = 'closed', transcript = ?, closedAt = CURRENT_TIMESTAMP WHERE channelId = ?")
              .run(JSON.stringify(transcript), channel.id);

            // 3. Post to #ticket_logs
            const logChannelId = Config.discord.channels.ticket_logs;
            const logChannel = channel.guild.channels.cache.get(logChannelId!) as TextChannel;
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📂 SESSION_ARCHIVED')
                    .setColor(0x2C3E50)
                    .addFields(
                        { name: 'Operator Channel', value: `\`${channel.name}\``, inline: true },
                        { name: 'Data Frames', value: `\`${transcript.logs.length} msgs\``, inline: true }
                    );

                const file = new AttachmentBuilder(jsonBuffer, { name: `transcript-${channel.name}.json` });
                await logChannel.send({ embeds: [logEmbed], files: [file] });
            }

            // 4. Teardown
            await channel.delete();
            Syslog.success('tickets', `Session ${channel.name} archived and purged.`, 'TICKET');
        } catch (err) {
            Syslog.error('tickets', `Closure failed for ${channel.id}`, err);
        }
    }
}