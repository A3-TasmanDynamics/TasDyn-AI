import { z } from 'zod';
import 'dotenv/config';
import { Syslog } from './syslog';

const envSchema = z.object({
    DISCORD_TOKEN: z.string().min(1, "Missing core Discord token"),
    DISCORD_CLIENT_ID: z.string().min(1, "Missing client ID"),
    API_WEATHER_TOKEN: z.string().optional(), 
    API_DATABASE_URL: z.string().url().optional(),
    DISCORD_CHANNEL_AUDIT_ID: z.string().min(1, "Missing audit channel ID"),
    DISCORD_CHANNEL_REPORT_ID: z.string().min(1, "Missing report channel ID"),
    DISCORD_CHANNEL_GATEKEEPER_ID: z.string().min(1, "Missing gatekeeper channel ID"),
    DISCORD_CHANNEL_SECURITYGATES_ID: z.string().min(1, "Missing security gates channel ID"),
    DISCORD_ROLE_ROOT_ID: z.string().min(1, "Missing root role ID"),
    DISCORD_ROLE_OWNER_ID: z.string().min(1, "Missing owner role ID"),
    DISCORD_ROLE_DEVELOPER_ID: z.string().min(1, "Missing developer role ID"),
    DISCORD_ROLE_STAFF_ID: z.string().min(1, "Missing staff role ID"),
    DISCORD_ROLE_COMMUNITY_ID: z.string().min(1, "Missing community role ID"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    Syslog.error('config', 'FATAL: Environment configuration is invalid.', parsed.error.format());
    process.exit(1); 
}

const env = parsed.data;

export const Config = {
    discord: {
        core: {
        token: env.DISCORD_TOKEN,
        clientId: env.DISCORD_CLIENT_ID,
        },
        channels: {
        audit: env.DISCORD_CHANNEL_AUDIT_ID,
        report: env.DISCORD_CHANNEL_REPORT_ID,
        gatekeeper: env.DISCORD_CHANNEL_GATEKEEPER_ID,
        securitygates: env.DISCORD_CHANNEL_SECURITYGATES_ID,
        },
        roles: {
            root: env.DISCORD_ROLE_ROOT_ID,
            owner: env.DISCORD_ROLE_OWNER_ID,
            developer: env.DISCORD_ROLE_DEVELOPER_ID,
            staff: env.DISCORD_ROLE_STAFF_ID,
            user: env.DISCORD_ROLE_COMMUNITY_ID,
        },
    },
    api: {
        weather: {
        token: env.API_WEATHER_TOKEN,
        },
        database: {
        url: env.API_DATABASE_URL,
        }
    }
} as const;