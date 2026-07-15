import { readFile, writeFile } from 'node:fs/promises';
import { TikTokLiveConnection } from 'tiktok-live-connector';

const USERNAME = 'feliiiocean';
const STATE_FILE = 'state.json';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  throw new Error('BOT_TOKEN oder CHAT_ID fehlt.');
}

async function telegramRequest(method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram-Fehler bei ${method}: ${JSON.stringify(result)}`
    );
  }

  return result.result;
}

async function readState() {
  try {
    const content = await readFile(STATE_FILE, 'utf8');
    const state = JSON.parse(content);

    return {
      live: typeof state.live === 'boolean' ? state.live : null,
      messageId: Number.isInteger(state.messageId)
        ? state.messageId
        : null
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        live: null,
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

async function sendStatusMessage(isLive) {
  const text = isLive
    ? (
        `🔴 Jorne ist jetzt LIVE auf TikTok!\n\n` +
        `👉 Direkt zum Live:\n` +
        `https://www.tiktok.com/@${USERNAME}/live`
      )
    : '⚫ Jorne ist aktuell offline.';

  const message = await telegramRequest('sendMessage', {
    chat_id: CHAT_ID,
    text
  });

  return message.message_id;
}

async function removePreviousStatus(messageId) {
  if (!messageId) {
    return;
  }

  try {
    await telegramRequest('deleteMessage', {
      chat_id: CHAT_ID,
      message_id: messageId
    });

    console.log('Die vorherige Statusmeldung wurde gelöscht.');
  } catch (deleteError) {
    console.warn(
      `Die vorherige Nachricht konnte nicht gelöscht werden: ${deleteError.message}`
    );

    /*
     * Sicherheitslösung:
     * Falls Telegram die alte Nachricht nicht mehr löschen lässt,
     * wird wenigstens der alte Link entfernt.
     */
    try {
      await telegramRequest('editMessageText', {
        chat_id: CHAT_ID,
        message_id: messageId,
        text: 'ℹ️ Diese ältere Statusmeldung ist nicht mehr aktuell.'
      });

      console.log('Der Inhalt der alten Statusmeldung wurde entfernt.');
    } catch (editError) {
      console.warn(
        `Die alte Nachricht konnte auch nicht bearbeitet werden: ${editError.message}`
      );
    }
  }
}

async function main() {
  const oldState = await readState();

  const connection = new TikTokLiveConnection(USERNAME, {});
  const isLive = await connection.fetchIsLive();

  console.log(
    `TikTok-Status von @${USERNAME}: ${isLive ? 'LIVE' : 'offline'}`
  );

  const statusChanged =
    oldState.live === null || oldState.live !== isLive;

  /*
   * Nur bei einem Statuswechsel wird eine neue Nachricht gesendet.
   * Gleicher Status = keinerlei neue Telegram-Nachricht.
   */
  if (!statusChanged && oldState.messageId) {
    console.log(
      `Status unverändert: ${isLive ? 'LIVE' : 'offline'}. ` +
      'Keine neue Telegram-Nachricht erforderlich.'
    );

    return;
  }

  await removePreviousStatus(oldState.messageId);

  const newMessageId = await sendStatusMessage(isLive);

  await writeState({
    live: isLive,
    messageId: newMessageId
  });

  console.log(
    `Neue ${isLive ? 'Live-' : 'Offline-'}Meldung wurde ` +
    `mit der ID ${newMessageId} gespeichert.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
