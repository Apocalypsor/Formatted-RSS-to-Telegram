import type { Telegram } from "@config";
import { config } from "@config";
import {
  type MEDIA_TYPE,
  TELEGRAM_API_BASE,
  TELEGRAM_MEDIA_GROUP_LIMIT,
} from "@consts";
import {
  FailedToEditMessageError,
  MessageNotFoundError,
  SendMessageFailedError,
} from "@errors";
import { getClient, logger } from "@utils";
import { HTTPError } from "ky";
import * as _ from "lodash-es";

interface TelegramResponse {
  ok?: boolean;
  result?: { message_id?: number } | { message_id?: number }[];
}

const tgEndpoint = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}${token}/${method}`;

export const getSender = (sender: string): Telegram | undefined => {
  return config.telegram.find((s) => s.name === sender);
};

export const send = async (
  sender: Telegram,
  text: string,
  mediaUrls?: {
    type: MEDIA_TYPE;
    url: string;
  }[],
): Promise<number> => {
  let sendByText = true;
  let payload: Record<string, unknown> = {};
  let endpoint: string = "";

  if (mediaUrls) {
    if (
      mediaUrls.length > 1 &&
      mediaUrls.length <= TELEGRAM_MEDIA_GROUP_LIMIT
    ) {
      sendByText = false;
      payload = {
        chat_id: sender.chatId,
        media: mediaUrls.map((item, index) => ({
          type: item.type,
          media: item.url,
          caption: index === 0 ? text : undefined,
          parse_mode: sender.parseMode,
        })),
        disable_notification: sender.disableNotification,
      };
      endpoint = tgEndpoint(sender.token, "sendMediaGroup");
    } else if (mediaUrls.length === 1 && mediaUrls[0]) {
      sendByText = false;
      payload = {
        chat_id: sender.chatId,
        caption: text,
        parse_mode: sender.parseMode,
        disable_notification: sender.disableNotification,
      };
      payload[mediaUrls[0].type] = mediaUrls[0].url;
      endpoint = tgEndpoint(
        sender.token,
        `send${_.capitalize(mediaUrls[0].type)}`,
      );
    }
  }

  if (sendByText) {
    payload = {
      chat_id: sender.chatId,
      text: text,
      parse_mode: sender.parseMode,
      disable_web_page_preview: sender.disableWebPagePreview,
      disable_notification: sender.disableNotification,
    };
    endpoint = tgEndpoint(sender.token, "sendMessage");
  }

  logger.debug(
    `Sending ${
      mediaUrls && mediaUrls.length > 0 ? "media group" : "message"
    } to ${sender.name}:\n${JSON.stringify(payload)}`,
  );

  const client = await getClient();
  const resp = await client
    .post(endpoint, { json: payload })
    .json<TelegramResponse>();

  if (resp?.ok) {
    const result = resp.result;
    const rawId = Array.isArray(result)
      ? result[0]?.message_id
      : result?.message_id;
    if (rawId == null) {
      throw new SendMessageFailedError(
        `${sender.name}: unexpected response structure, missing message_id`,
      );
    }
    const messageId = Number(rawId);
    logger.info(`Message ${messageId} sent to ${sender.name}.`);
    return messageId;
  } else {
    throw new SendMessageFailedError(sender.name);
  }
};

const editText = async (sender: Telegram, messageId: number, text: string) => {
  const endpoint = tgEndpoint(sender.token, "editMessageText");
  const payload = {
    chat_id: sender.chatId,
    message_id: messageId,
    text: text,
    parse_mode: sender.parseMode,
    disable_web_page_preview: sender.disableWebPagePreview,
    disable_notification: sender.disableNotification,
  };
  const client = await getClient();
  const resp = await client
    .post(endpoint, { json: payload })
    .json<TelegramResponse>();
  return resp.ok;
};

const editCaption = async (
  sender: Telegram,
  messageId: number,
  caption: string,
) => {
  const endpoint = tgEndpoint(sender.token, "editMessageCaption");
  const payload = {
    chat_id: sender.chatId,
    message_id: messageId,
    caption: caption,
    parse_mode: sender.parseMode,
  };
  const client = await getClient();
  const resp = await client
    .post(endpoint, { json: payload })
    .json<TelegramResponse>();
  return resp.ok;
};

const getTelegramErrorDescription = async (
  e: unknown,
): Promise<string | null> => {
  if (e instanceof HTTPError && e.response) {
    try {
      const body = (await e.response.json()) as { description?: string };
      return body?.description ?? null;
    } catch {
      return null;
    }
  }
  return null;
};

export const edit = async (
  sender: Telegram,
  messageId: number,
  text: string,
) => {
  try {
    // Try editing as text first, fall back to caption for media messages
    const edited = await editText(sender, messageId, text).catch(async (e) => {
      const desc = await getTelegramErrorDescription(e);
      if (desc?.includes("there is no text in the message to edit")) {
        return editCaption(sender, messageId, text);
      }
      throw e;
    });

    if (edited) {
      logger.info(`Message ${messageId} edited for ${sender.name}.`);
    }
  } catch (e) {
    const desc = await getTelegramErrorDescription(e);
    if (!desc) throw e;

    if (
      desc.includes("message to edit not found") ||
      desc.includes("MESSAGE_ID_INVALID")
    ) {
      throw new MessageNotFoundError(messageId, sender.name);
    }
    throw new FailedToEditMessageError(messageId, sender.name);
  }
};

export const notify = async (url: string) => {
  if (config.telegram.length === 0 || !config.notifyTelegramChatId) {
    logger.warn("No Telegram sender for notification configured, skipping.");
    return;
  }

  const sender = config.telegram[0];
  if (!sender) return;
  const endpoint = tgEndpoint(sender.token, "sendMessage");
  const payload = {
    chat_id: config.notifyTelegramChatId,
    text: `*FR2T detected a link expired*\n\n${url}`,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  try {
    logger.info(`Sending notification to ${sender.name}:\n${url}`);
    const client = await getClient(true);
    await client.post(endpoint, { json: payload });
  } catch (e) {
    logger.warn(
      `Failed to send notification for ${url}: ${e instanceof Error ? e.message : e}`,
    );
  }
};
