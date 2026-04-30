import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Syslog } from '../../core/syslog';
import { db } from '../../core/database';
import { fetchLatestEntry, ChangelogEntry } from './changelogScraper';

interface WatchedItem {
    id: string;
    name: string;
}

/**
 * Steam Workshop items to monitor.
 * Add a new entry here to track additional mods — nothing else needs to change.
 */
const WATCHED_ITEMS: WatchedItem[] = [
    {
        id: '3522482834',
        name: 'Realistic Airborne',
    },
];

export class SteamWatchService {
    /**
     * Iterates all watched items and posts new changelogs to the releases channel.
     * Called once on ready, then on a polling interval.
     */
    static async check(client: Client): Promise<void> {
        for (const item of WATCHED_ITEMS) {
            await this.processItem(client, item);
        }
    }

    private static async processItem(client: Client, item: WatchedItem): Promise<void> {
        try {
            const entry = await fetchLatestEntry(item.id);
            if (!entry) return;

            const stored = db
                .prepare('SELECT last_entry_date FROM steam_watch WHERE item_id = ?')
                .get(item.id) as { last_entry_date: string } | undefined;

            // Nothing new — already posted this entry
            if (stored?.last_entry_date === entry.date) return;

            // Persist before posting — prevents double-posts if the channel send fails
            db.prepare(`
                INSERT INTO steam_watch (item_id, last_entry_date, updatedAt)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(item_id) DO UPDATE
                    SET last_entry_date = excluded.last_entry_date,
                        updatedAt = CURRENT_TIMESTAMP
            `).run(item.id, entry.date);

            await this.post(client, item, entry);
            Syslog.success('steam_watch', `Changelog dispatched for ${item.name}: ${entry.title}`);
        } catch (err) {
            Syslog.error('steam_watch', `Failed to process Steam Watch item: ${item.name}`, err);
        }
    }

    private static async post(client: Client, item: WatchedItem, entry: ChangelogEntry): Promise<void> {
        const channelId = process.env.DISCORD_CHANNEL_RELEASES_ID;
        if (!channelId) {
            Syslog.warn('steam_watch', 'DISCORD_CHANNEL_RELEASES_ID is not set — cannot dispatch changelog.');
            return;
        }

        const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel | null;
        if (!channel?.isTextBased()) {
            Syslog.warn('steam_watch', `Releases channel (${channelId}) not found or is not a text channel.`);
            return;
        }

        // Trim body to Discord embed description limit
        const description = entry.body.length > 2048
            ? entry.body.slice(0, 2045) + '...'
            : entry.body || '_No description provided._';

        const workshopUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.id}`;
        const changelogUrl = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${item.id}`;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'STEAM_WORKSHOP // CHANGELOG_UPDATE',
                iconURL: 'https://community.fastly.steamstatic.com/public/shared/images/header/logo_steam.svg?t=962016',
                url: changelogUrl,
            })
            .setTitle(`${item.name.toUpperCase()}  //  ${entry.title.toUpperCase()}`)
            .setURL(changelogUrl)
            .setColor(0xFF6B35)
            .setDescription(description)
            .addFields(
                { name: '📅 PUBLISHED', value: entry.date, inline: true },
                { name: '🔗 WORKSHOP', value: `[View Page](${workshopUrl})`, inline: true },
            )
            .setFooter({ text: 'STEAM_WATCH // WORKSHOP_TRACKER  •  Powered by TasDyn AI' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }
}
