import { Syslog } from '../../core/syslog';

export interface ChangelogEntry {
    /** Raw date string scraped from the page, e.g. "29 Apr @ 11:19pm" */
    date: string;
    /** The update headline / version, e.g. "Version 1.0.3" */
    title: string;
    /** Human-readable body text converted from HTML */
    body: string;
}

const CHANGELOG_BASE = 'https://steamcommunity.com/sharedfiles/filedetails/changelog/';

/**
 * Fetches the changelog page for a given Steam Workshop item and returns
 * the most recent entry, or null on failure.
 */
export async function fetchLatestEntry(itemId: string): Promise<ChangelogEntry | null> {
    try {
        const response = await fetch(`${CHANGELOG_BASE}${itemId}`, {
            headers: {
                'User-Agent': 'TasDyn-AI-SteamWatch/1.0 (Discord Bot; github.com/A3-TasmanDynamics)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            Syslog.warn('steam_scraper', `HTTP ${response.status} fetching changelog for item ${itemId}`);
            return null;
        }

        const html = await response.text();
        return parseFirstEntry(html);
    } catch (err) {
        Syslog.error('steam_scraper', `Failed to fetch changelog for item ${itemId}`, err);
        return null;
    }
}

/**
 * Parses the raw HTML of a Steam changelog page and extracts the first (latest) entry.
 */
function parseFirstEntry(html: string): ChangelogEntry | null {
    // Each changelog entry lives inside a div.detailBox — grab the first one
    const blockMatch = html.match(/<div[^>]*class="[^"]*detailBox[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*detailBox|<div[^>]*id="footer)/);
    if (!blockMatch) return null;

    const block = blockMatch[1];

    // --- Date ---
    // Steam renders: <span class="changelog_date">Update: 29 Apr @ 11:19pm</span>
    const dateMatch =
        block.match(/class="changelog_date"[^>]*>\s*Update:\s*([^<\n]+?)\s*</) ??
        block.match(/Update:\s*([^\n<]+?)\s*(?:by\s|<)/i);
    const date = dateMatch ? dateMatch[1].trim() : 'Unknown';

    // --- Title ---
    // Steam wraps the version/title in the first <h1> of the entry
    const titleMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : 'Update';

    // --- Body ---
    // Everything between the closing </h1> and the "Discuss this update" link
    const bodyStart = block.indexOf('</h1>');
    const discussIdx = block.indexOf('Discuss this update');
    const bodyHtml = bodyStart !== -1
        ? block.slice(bodyStart + 5, discussIdx !== -1 ? discussIdx : undefined)
        : '';
    const body = htmlToText(bodyHtml).trim();

    return { date, title, body };
}

/**
 * Converts the inner HTML of a Steam changelog entry to clean readable text,
 * preserving section headers and bullet points.
 */
function htmlToText(html: string): string {
    return html
        // Section headings → bold
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t) => `\n**${stripTags(t).trim()}**\n`)
        // List items → bullet points
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `• ${stripTags(t).trim()}\n`)
        // Block breaks
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        // Strip remaining tags
        .replace(/<[^>]+>/g, '')
        // HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Collapse excess blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
}
