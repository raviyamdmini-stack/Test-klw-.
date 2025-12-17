const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

const RANKING_FOLDER = path.join(__dirname, 'database', 'ranking');
if (!fs.existsSync(RANKING_FOLDER)) fs.mkdirSync(RANKING_FOLDER, { recursive: true });

// In-memory cache
const rankingCache = {};
const groupsToSave = new Set();

const getDayKey = () => moment().tz('Asia/Colombo').format('YYYY-MM-DD');
const getWeekKey = () => moment().tz('Asia/Colombo').format('YYYY-WW');

const loadGroup = (groupId) => {
    const file = `${RANKING_FOLDER}/${groupId}.json`;
    if (!rankingCache[groupId]) {
        if (fs.existsSync(file)) {
            try {
                rankingCache[groupId] = JSON.parse(fs.readFileSync(file, 'utf-8'));
            } catch {
                rankingCache[groupId] = {};
            }
        } else {
            rankingCache[groupId] = {};
        }
    }
    return rankingCache[groupId];
};

// Auto-save every 60s
setInterval(() => {
    for (const groupId of groupsToSave) {
        const file = `${RANKING_FOLDER}/${groupId}.json`;
        try {
            fs.writeFileSync(file, JSON.stringify(rankingCache[groupId], null, 2), 'utf-8');
        } catch (e) {
            console.error('Failed to save ranking file:', e);
        }
        groupsToSave.delete(groupId);
    }
}, 60 * 1000);

// MESSAGE LISTENER
async function rankingListener(msg, finalLid, isGroup, isBot) {
    if (!isGroup || isBot) return;

    try {
        const groupId = msg.key.remoteJid;
        const senderId = finalLid;

        const rankDb = loadGroup(groupId);

        if (!rankDb[senderId]) {
            rankDb[senderId] = {
                global: 0,
                daily: { count: 0, dayKey: getDayKey() },
                weekly: { count: 0, weekKey: getWeekKey() }
            };
        }

        const user = rankDb[senderId];
        const dayKey = getDayKey();
        const weekKey = getWeekKey();

        user.global++;

        user.daily = user.daily?.dayKey === dayKey ? { ...user.daily, count: user.daily.count + 1 } : { count: 1, dayKey };
        user.weekly = user.weekly?.weekKey === weekKey ? { ...user.weekly, count: user.weekly.count + 1 } : { count: 1, weekKey };

        groupsToSave.add(groupId);

    } catch (e) {
        console.error('Ranking Listener Error:', e);
    }
}

// RANKING / DAILY / WEEKLY
async function rankingCommand(AlexaInc, msg, args, command, groupMetadata = {}) {
    const chatId = msg.key.remoteJid;
    const rankDb = loadGroup(chatId);

    if (!Object.keys(rankDb).length) {
        return AlexaInc.sendMessage(chatId, { text: '📊 No ranking data yet.' }, { quoted: msg });
    }

    let mode = 'global';
    const text = (args.join(' ') || '').toLowerCase();

    if (command.includes('daily') || text.includes('daily')) mode = 'daily';
    else if (command.includes('weekly') || text.includes('weekly')) mode = 'weekly';

    const dayKey = getDayKey();
    const weekKey = getWeekKey();

    const sorted = Object.entries(rankDb)
        .map(([id, data]) => {
            let count = 0;
            if (mode === 'global') count = data.global || 0;
            if (mode === 'daily' && data.daily?.dayKey === dayKey) count = data.daily.count || 0;
            if (mode === 'weekly' && data.weekly?.weekKey === weekKey) count = data.weekly.count || 0;
            return { id, count };
        })
        .filter(u => u.count > 0)
        .sort((a, b) => b.count - a.count);

    if (!sorted.length) {
        return AlexaInc.sendMessage(chatId, { text: `📉 No ${mode} data yet.` }, { quoted: msg });
    }

    const top = sorted.slice(0, 15);
    let textOut = `🏆 *${mode.toUpperCase()} CHAT RANKING*\n`;
    textOut += `_Group: ${groupMetadata.subject || 'Unknown'}_\n\n`;

    const mentions = [];
    top.forEach((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        mentions.push(u.id);
        textOut += `${medal} @${u.id.split('@')[0]} : *${u.count}*\n`;
    });
    textOut += `\n_Total active users: ${sorted.length}_`;

    await AlexaInc.sendMessage(chatId, { text: textOut, mentions }, { quoted: msg });
}

// MYRANK
async function myRankCommand(AlexaInc, msg, finalLid) {
    const chatId = msg.key.remoteJid;
    const rankDb = loadGroup(chatId);
    const user = rankDb[finalLid];

    if (!user) {
        return AlexaInc.sendMessage(chatId, { text: '📉 You have no ranking yet.' }, { quoted: msg });
    }

    const sorted = Object.entries(rankDb)
        .map(([id, d]) => ({ id, global: d.global || 0 }))
        .sort((a, b) => b.global - a.global);

    const index = sorted.findIndex(u => u.id === finalLid);
    const rank = index + 1;

    const text =
`👤 *YOUR RANK*
🏆 Rank: #${rank} / ${sorted.length}
🌐 Global: ${user.global}
📅 Daily: ${user.daily?.count || 0}
🗓️ Weekly: ${user.weekly?.count || 0}`;

    await AlexaInc.sendMessage(chatId, { text, mentions: [finalLid] }, { quoted: msg });
}

// COMMAND HANDLER
async function handleRankingCommands(AlexaInc, msg, isGroup, finalLid, groupMetadata = {}) {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!body.startsWith('.')) return;

    const args = body.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (['ranking', 'daily', 'weekly'].includes(command)) {
        if (!isGroup) return AlexaInc.sendMessage(msg.key.remoteJid, { text: '❌ Ranking works only in groups.' }, { quoted: msg });
        await rankingCommand(AlexaInc, msg, args, command, groupMetadata);
    }

    if (command === 'myrank') {
        if (!isGroup) return AlexaInc.sendMessage(msg.key.remoteJid, { text: '❌ This command works only in groups.' }, { quoted: msg });
        await myRankCommand(AlexaInc, msg, finalLid);
    }
}

module.exports = {
    rankingListener,
    rankingCommand,
    myRankCommand,
    handleRankingCommands
};