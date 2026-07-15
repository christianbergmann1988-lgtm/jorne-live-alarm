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
    const state = JSON.parse(content);

    return {
      live: Boolean(state.live),
      messageId: state.messageId ?? null
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        live: false,
        messageId: null
      };
    }

    throw error;
  }
}

async function writeState(state) {
  await writeFile(
    STATE_FILE,
    JSON.stringify(state, null, 2) + '\n',
    'utf8'
  );
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
        text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram-Nachricht konnte nicht gesendet werden: ${JSON.stringify(result)}`
    );
  }

  return result.result.message_id;
}

async function deleteTelegramMessage(messageId) {
  if (!messageId) {
    console.log('Keine gespeicherte Telegram-Nachricht zum Löschen vorhanden.');
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        message_id: messageId
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.warn(
      `Telegram-Nachricht konnte nicht gelöscht werden: ${JSON.stringify(result)}`
    );
    return;
  }

  console.log('Die bisherige Live-Nachricht wurde aus Telegram gelöscht.');
}

async function main() {
  const oldState = await readState();

  const connection = new TikTokLiveConnection(USERNAME, {});
  const isLive = await connection.fetchIsLive();

  console.log(
    `TikTok-Status von @${USERNAME}: ${isLive ? 'LIVE' : 'offline'}`
  );

  let newState;

  if (isLive) {
    if (!oldState.live || !oldState.messageId) {
      const messageId = await sendTelegramMessage(
        `🔴 Jorne ist jetzt LIVE auf TikTok!\n\n` +
        `👉 Direkt zum Live:\n` +
        `https://www.tiktok.com/@${USERNAME}/live`
      );

      newState = {
        live: true,
        messageId
      };

      console.log(
        `Telegram-Nachricht wurde gesendet und mit der ID ${messageId} gespeichert.`
      );
    } else {
      newState = oldState;
      console.log(
        'Jorne war bereits als LIVE gespeichert. Keine weitere Nachricht gesendet.'
      );
    }
  } else {
    if (oldState.live) {
      await deleteTelegramMessage(oldState.messageId);
    } else {
      console.log('Jorne war bereits als offline gespeichert.');
    }

    newState = {
      live: false,
      messageId: null
    };
  }

  await writeState(newState);
  console.log('Neuer Status wurde in state.json gespeichert.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
