import { ModuleConfig } from '../../core/types';
import { BroadcastCommand } from '../commands/broadcast';
import { handleBroadcastModalSubmit } from './modalHandler';

const BroadcastModule: ModuleConfig = {
    name: 'broadcast',
    description: 'Broadcast announcement system — operator dispatch to any guild channel via modal.',

    commands: [BroadcastCommand],

    interactions: [
        // Broadcast modal submission (customId format: modal_broadcast_<channelId>)
        {
            match: /^modal_broadcast_/,
            type: 'modal',
            execute: (interaction, client) => handleBroadcastModalSubmit(interaction, client),
        },
    ],
};

export default BroadcastModule;
