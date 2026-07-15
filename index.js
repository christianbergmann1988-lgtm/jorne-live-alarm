import { readFile, writeFile } from 'node:fs/promises';
import { TikTokLiveConnection } from 'tiktok-live-connector';

const USERNAME = 'feliiiocean';
const STATE_FILE = 'state.json';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  throw new Error('BOT_TOKEN oder CHAT_ID fehlt.');
}

async function readState() {
  try {
    const content = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { live: false };
    }

    throw error;
  }
}

async function sendTelegramMessage(text) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram-Fehler: ${JSON.stringify(result)}`);
  }
}

async function main() {
  const oldState = await readState();
  const connection = new TikTokLiveConnection(USERNAME, {});

  const isLive = await connection.fetchIsLive();

  console.log(
    `TikTok-Status von @${USERNAME}: ${isLive ? 'LIVE' : 'offline'}`
  );

  if (isLive && !oldState.live) {
    await sendTelegramMessage(
      `🔴 Jorne ist jetzt LIVE auf TikTok!\n\n` +
      `👉 Direkt zum Live:\n` +
      `https://www.tiktok.com/@${USERNAME}/live`
    );

    console.log('Telegram-Nachricht wurde gesendet.');
  } else {
    console.log('Keine neue Telegram-Nachricht erforderlich.');
  }

  await writeFile(
    STATE_FILE,
    JSON.stringify({ live: isLive }, null, 2) + '\n',
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
