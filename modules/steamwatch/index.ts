import { Client } from 'discord.js';
import { ModuleConfig } from '../../core/types';
import { Syslog } from '../../core/syslog';
import { SteamWatchService } from './steamWatchService';

const SteamWatchModule: ModuleConfig = {
    name: 'steamwatch',
    description: 'Steam Workshop changelog tracker — polls for new mod updates and posts them to the releases channel.',

    onReady: [
        async (client: Client) => {
            Syslog.info('steam_watch', 'Initializing Steam Workshop Tracker...');

            // Initial check on boot
            await SteamWatchService.check(client);

            // Poll every 30 minutes
            setInterval(async () => {
                await SteamWatchService.check(client);
            }, 30 * 60 * 1000);
        },
    ],
};

export default SteamWatchModule;
