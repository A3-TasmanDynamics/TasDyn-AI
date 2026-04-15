import { REST, Routes } from 'discord.js';
import { OperatorCommand } from '../modules/commands/operator';
import 'dotenv/config';

const commands = [
    OperatorCommand.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_CORE_TOKEN!);

(async () => {
    try {
        console.log('📡 [NETWORK] Initiating Command Sync...');

        // STEP 1: NUKE GLOBAL COMMANDS
        // This clears any "ghost" commands stuck at the account level
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] });
        console.log('✅ [CLEAN] Global command cache cleared.');

        // STEP 2: REGISTER GUILD COMMANDS
        // This pushes /operator specifically to your dev server for instant update
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
            { body: commands }
        );

        console.log(`🚀 [SUCCESS] TasDyn Operator Suite deployed to Guild: ${process.env.GUILD_ID}`);
    } catch (error) {
        console.error('❌ [CRITICAL] Deployment failed:', error);
    }
})();