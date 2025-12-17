module.exports = async function startBot(onMessage) {
    const { makeWASocket } = require('@whiskeysockets/baileys');

    const sock = makeWASocket({ printQRInTerminal: true });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const context = {
            finalLid: msg.key.participant || msg.key.remoteJid,
            isGroup: msg.key.remoteJid.endsWith('@g.us'),
            isBot: msg.key.fromMe,
            command: '', // parse command here
            args: [],
            groupMetadata: {},
            AlexaInc: sock
        };

        await onMessage(sock, msg, context);
    });
};