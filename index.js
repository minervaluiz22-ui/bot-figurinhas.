const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const http = require('http');

// COLOQUE SEU NÚMERO AQUI (55 + DDD + NÚMERO, SEM ESPAÇOS):
const SEU_NUMERO = '559198070-6132';

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Figurinhas Online!');
}).listen(process.env.PORT || 8000);

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sessao');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const code = await sock.requestPairingCode(SEU_NUMERO);
            console.log('\n========================================');
            console.log('SEU CÓDIGO DE CONEXÃO:', code);
            console.log('========================================\n');
        }, 4000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('\n✅ BOT ONLINE NA NUVEM! Envie uma foto com !s');
        }
        if (connection === 'close') {
            iniciarBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';

        if (texto.toLowerCase() === '!s' || texto.toLowerCase() === '!sticker') {
            const isImage = msg.message.imageMessage;
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

            if (isImage || quoted) {
                const targetMsg = isImage ? msg : { message: { imageMessage: quoted } };
                const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                
                fs.writeFileSync('temp.jpg', buffer);
                
                exec(`"${ffmpegPath}" -i temp.jpg -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -y temp.webp`, async () => {
                    await sock.sendMessage(from, { sticker: fs.readFileSync('temp.webp') }, { quoted: msg });
                    fs.unlinkSync('temp.jpg');
                    fs.unlinkSync('temp.webp');
                });
            }
        }
    });
}

iniciarBot();
