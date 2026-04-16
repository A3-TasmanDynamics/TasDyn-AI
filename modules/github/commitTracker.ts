import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Config } from '../../core/config';
import { Syslog } from '../../core/syslog';
import { db } from '../../core/database';

export class CommitTracker {
    private static ORG_NAME = 'A3-TasmanDynamics';
    private static API_BASE = 'https://api.github.com';

    /**
     * Entry point called by the Kernel heartbeat
     */
    static async checkCommits(client: Client) {
        try {
            const repos = await this.fetchOrgRepos();
            
            for (const repo of repos) {
                await this.processRepoCommits(client, repo);
            }
        } catch (error) {
            Syslog.error('github_uplink', 'Failed to synchronize with GitHub Organization API.', error);
        }
    }

    /**
     * Fetches all active repositories for the organization
     */
    private static async fetchOrgRepos(): Promise<any[]> {
        const response = await fetch(`${this.API_BASE}/orgs/${this.ORG_NAME}/repos?sort=updated`, {
            headers: {
                'User-Agent': 'TasDyn-AI-Sovereign',
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Filter out archived or disabled repos to keep the logs clean
        return data.filter((r: any) => !r.archived && !r.disabled);
    }

    /**
     * Checks a specific repo for new commits
     */
    private static async processRepoCommits(client: Client, repo: any) {
        try {
            const response = await fetch(`${this.API_BASE}/repos/${repo.full_name}/commits?per_page=1`, {
                headers: {
                    'User-Agent': 'TasDyn-AI-Sovereign',
                    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
                }
            });

            if (!response.ok) return;

            const commits = await response.json();
            if (!commits || commits.length === 0) return;

            const latest = commits[0];
            const record = db.prepare("SELECT lastSha FROM github_commits WHERE repoName = ?").get(repo.full_name) as { lastSha: string } | undefined;

            if (!record || record.lastSha !== latest.sha) {
                await this.broadcastCommit(client, repo.name, latest);
                
                db.prepare("INSERT OR REPLACE INTO github_commits (repoName, lastSha, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)")
                  .run(repo.full_name, latest.sha);
            }
        } catch (e) {
            Syslog.error('github_uplink', `Failed to process commits for ${repo.name}`, e);
        }
    }

    private static async broadcastCommit(client: Client, repoName: string, commit: any) {
        const channelId = Config.discord.channels.dev_logs;
        const channel = await client.channels.fetch(channelId!) as TextChannel;
        if (!channel) return;

        const message = commit.commit.message;
        const truncated = message.length > 256 ? message.substring(0, 253) + '...' : message;

        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: `GITHUB_UPLINK // DATA_PUSH`, 
                iconURL: commit.author?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' 
            })
            .setTitle(`🛠️ ${repoName.toUpperCase()} // \`${commit.sha.substring(0, 7)}\``)
            .setURL(commit.html_url)
            .setColor(0x3498DB)
            .setDescription(`**Author:** \`${commit.commit.author.name}\`\n\`\`\`\n${truncated}\n\`\`\``)
            .setFooter({ text: `Repo: ${repoName} // Branch: main` })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }
}