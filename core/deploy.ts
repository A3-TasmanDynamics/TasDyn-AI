import 'dotenv/config'; // Move this to the absolute top
import { REST, Routes } from 'discord.js';
import { OperatorCommand } from '../modules/commands/operator';
import { TicketCommand } from '../modules/commands/tickets';

// 1. Pre-Flight Token Check
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('❌ [CRITICAL] Environment Variables Missing!');
    console.log(`- Token Present: ${!!token}`);
    console.log(`- Client ID Present: ${!!clientId}`);
    console.log(`- Guild ID Present: ${!!guildId}`);
    process.exit(1);
}

const commands = [
    OperatorCommand.data.toJSON(),
    TicketCommand.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`📡 [NETWORK] Initiating Sync for ${commands.length} modular commands...`);

        // 2. PURGE GLOBAL CACHE
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ [CLEAN] Global command cache purged.');

        // 3. REGISTER GUILD COMMANDS
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`🚀 [SUCCESS] TasDyn Operator Suite deployed to Guild: ${guildId}`);
        
    } catch (error) {
        console.error('❌ [CRITICAL] Sync Failure:', error);
    }
})();