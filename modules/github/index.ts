import { Client } from 'discord.js';
import { ModuleConfig } from '../../core/types';
import { Syslog } from '../../core/syslog';
import { CommitTracker } from './commitTracker';

const GitHubModule: ModuleConfig = {
    name: 'github',
    description: 'GitHub commit tracker — polls the org for new commits and posts to dev-logs on a 5-minute heartbeat.',

    onReady: [
        async (client: Client) => {
            Syslog.info('github_uplink', 'Initializing Dev Heartbeat Service...');
            await CommitTracker.checkCommits(client);

            setInterval(async () => {
                await CommitTracker.checkCommits(client);
            }, 5 * 60 * 1000);
        },
    ],
};

export default GitHubModule;
