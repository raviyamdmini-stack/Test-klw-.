// ================================
// IMPORTS
// ================================
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('events').EventEmitter.defaultMaxListeners = 500;

const app = express();
const PORT = process.env.PORT || 8000;
const __path = process.cwd();

// Pair route
const pairRoute = require('./pair');

// Ranking system
const {
    rankingListener,
    rankingCommand,
    myRankCommand
} = require('./ranking');

// WhatsApp connection (Baileys)
const startBot = require('./bot'); // 👈 your Baileys init file

// ================================
// EXPRESS CONFIG
// ================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/code', pairRoute);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__path, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__path, 'main.html'));
});

// ================================
// START SERVER
// ================================
app.listen(PORT, () => {
    console.log(`
Don't Forget To Give Star ‼️

𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 𝐋𝙾𝙺𝚄 𝐑𝙸𝙺𝙾

Server running on http://localhost:${PORT}
`);
});

// ================================
// START WHATSAPP BOT
// ================================
startBot(async (sock, msg, context) => {
    /**
     * context should provide:
     * finalLid, isGroup, isBot,
     * command, args, groupMetadata, AlexaInc
     */

    const {
        finalLid,
        isGroup,
        isBot,
        command,
        args,
        groupMetadata,
        AlexaInc
    } = context;

    // ================================
    // MESSAGE LISTENER (RANK COUNT)
    // ================================
    await rankingListener(msg, finalLid, isGroup, isBot);

    // ================================
    // COMMAND HANDLER
    // ================================
    switch (command) {
        case 'ranking':
        case 'daily':
        case 'weekly':
            await rankingCommand(
                AlexaInc,
                msg,
                args,
                command,
                groupMetadata
            );
            break;

        case 'rank':
        case 'myrank':
            await myRankCommand(
                AlexaInc,
                msg,
                finalLid
            );
            break;
    }
});

module.exports = app;