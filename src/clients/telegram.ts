import type { Telegram } from "@config";
import {
  MEDIA_TYPE,
  TELEGRAM_API_BASE,
  TELEGRAM_MEDIA_GROUP_LIMIT,
} from "@consts";
import {
  FailedToEditMessageError,
  MessageNotFoundError,
  SendMessageFailedError,
} from "@errors";
import { HTTPError } from "ky";
import { logger } from "../utils/logger";
import { getClient } from "./ky";

export interface MediaItem {
  type: MEDIA_TYPE;
  url: string;
}

export interface TgRequest {
  endpoint: string;
  payload: Record<string, unknown>;
}

interface TelegramResponse {
  ok?: boolean;
  result?: { message_id?: number } | { message_id?: number }[];
}

const tgEndpoint = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}${token}/${method}`;

const buildTextRequest = (sender: Telegram, text: string): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMessage"),
  payload: {
    chat_id: sender.chatId,
    text,
    parse_mode: sender.parseMode,
    disable_web_page_preview: sender.disableWebPagePreview,
    disable_notification: sender.disableNotification,
  },
});

const buildSingleMediaRequest = (
  sender: Telegram,
  text: string,
  media: MediaItem,
): TgRequest => ({
  endpoint: tgEndpoint(
    sender.token,
    media.type === MEDIA_TYPE.PHOTO ? "sendPhoto" : "sendVideo",
  ),
  payload: {
    chat_id: sender.chatId,
    [media.type]: media.url,
    caption: text,
    parse_mode: sender.parseMode,
    disable_notification: sender.disableNotification,
  },
});

const buildMediaGroupRequest = (
  sender: Telegram,
  text: string,
  mediaUrls: MediaItem[],
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMediaGroup"),
  payload: {
    chat_id: sender.chatId,
    media: mediaUrls.map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? text : undefined,
      parse_mode: sender.parseMode,
    })),
    disable_notification: sender.disableNotification,
  },
});

export const buildSendRequest = (
  sender: Telegram,
  text: string,
  mediaUrls?: MediaItem[],
): TgRequest => {
  if (sender.parseMode === "RichHTML") {
    return {
      endpoint: tgEndpoint(sender.token, "sendRichMessage"),
      payload: {
        chat_id: sender.chatId,
        rich_message: { html: text },
        disable_notification: sender.disableNotification,
      },
    };
  }

  if (mediaUrls?.[0]) {
    if (mediaUrls.length === 1) {
      return buildSingleMediaRequest(sender, text, mediaUrls[0]);
    }
    if (mediaUrls.length <= TELEGRAM_MEDIA_GROUP_LIMIT) {
      return buildMediaGroupRequest(sender, text, mediaUrls);
    }
  }

  return buildTextRequest(sender, text);
};

export const buildEditTextRequest = (
  sender: Telegram,
  messageId: number,
  text: string,
): TgRequest =>
  sender.parseMode === "RichHTML"
    ? {
        endpoint: tgEndpoint(sender.token, "editMessageText"),
        payload: {
          chat_id: sender.chatId,
          message_id: messageId,
          rich_message: { html: text },
        },
      }
    : {
        endpoint: tgEndpoint(sender.token, "editMessageText"),
        payload: {
          chat_id: sender.chatId,
          message_id: messageId,
          text,
          parse_mode: sender.parseMode,
          disable_web_page_preview: sender.disableWebPagePreview,
          disable_notification: sender.disableNotification,
        },
      };

export const buildEditCaptionRequest = (
  sender: Telegram,
  messageId: number,
  caption: string,
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "editMessageCaption"),
  payload: {
    chat_id: sender.chatId,
    message_id: messageId,
    caption,
    parse_mode: sender.parseMode,
  },
});

export const buildExpirationNotificationRequest = (
  sender: Telegram,
  chatId: number,
  url: string,
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMessage"),
  payload: {
    chat_id: chatId,
    text: `*FR2T detected a link expired*\n\n${url}`,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  },
});

const parseMessageId = (resp: TelegramResponse, senderName: string): number => {
  const result = resp.result;
  const rawId = Array.isArray(result)
    ? result[0]?.message_id
    : result?.message_id;
  if (rawId == null) {
    throw new SendMessageFailedError(
      `${senderName}: unexpected response structure, missing message_id`,
    );
  }
  return Number(rawId);
};

export const send = async (
  sender: Telegram,
  text: string,
  mediaUrls?: MediaItem[],
): Promise<number> => {
  const { endpoint, payload } = buildSendRequest(sender, text, mediaUrls);

  logger.debug(
    `Sending ${
      mediaUrls && mediaUrls.length > 0 ? "media group" : "message"
    } to ${sender.name}:\n${JSON.stringify(payload)}`,
  );

  const client = await getClient();
  const resp = await client
    .post(endpoint, { json: payload })
    .json<TelegramResponse>();

  if (!resp?.ok) {
    throw new SendMessageFailedError(sender.name);
  }

  const messageId = parseMessageId(resp, sender.name);
  logger.info(`Message ${messageId} sent to ${sender.name}.`);
  return messageId;
};

const editText = async (sender: Telegram, messageId: number, text: string) => {
  const { endpoint, payload } = buildEditTextRequest(sender, messageId, text);
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
  const { endpoint, payload } = buildEditCaptionRequest(
    sender,
    messageId,
    caption,
  );
  const client = await getClient();
  const resp = await client
    .post(endpoint, { json: payload })
    .json<TelegramResponse>();
  return resp.ok;
};

const getTelegramErrorDescription = async (
  error: unknown,
): Promise<string | null> => {
  if (error instanceof HTTPError && error.response) {
    try {
      const body = (await error.response.json()) as { description?: string };
      return body?.description ?? null;
    } catch {
      return null;
    }
  }
  return null;
};

const throwEditError = async (
  error: unknown,
  messageId: number,
  sender: Telegram,
  knownDescription?: string | null,
): Promise<never> => {
  const desc = knownDescription ?? (await getTelegramErrorDescription(error));
  if (!desc) throw error;

  if (
    desc.includes("message to edit not found") ||
    desc.includes("MESSAGE_ID_INVALID")
  ) {
    throw new MessageNotFoundError(messageId, sender.name);
  }
  throw new FailedToEditMessageError(messageId, sender.name);
};

export const edit = async (
  sender: Telegram,
  messageId: number,
  text: string,
): Promise<number> => {
  try {
    const edited = await editText(sender, messageId, text);
    if (edited) {
      logger.info(`Message ${messageId} edited for ${sender.name}.`);
    }
    return messageId;
  } catch (error) {
    const desc = await getTelegramErrorDescription(error);
    if (desc?.includes("there is no text in the message to edit")) {
      if (sender.parseMode === "RichHTML") {
        const replacementId = await send(sender, text);
        logger.info(
          `Message ${replacementId} sent as a RichHTML replacement for ${messageId} on ${sender.name}.`,
        );
        return replacementId;
      }

      try {
        const edited = await editCaption(sender, messageId, text);
        if (edited) {
          logger.info(`Message ${messageId} edited for ${sender.name}.`);
        }
        return messageId;
      } catch (captionError) {
        return throwEditError(captionError, messageId, sender);
      }
    }

    return throwEditError(error, messageId, sender, desc);
  }
};

export const sendExpirationNotification = async (
  sender: Telegram,
  chatId: number,
  url: string,
): Promise<void> => {
  const { endpoint, payload } = buildExpirationNotificationRequest(
    sender,
    chatId,
    url,
  );
  try {
    logger.info(`Sending notification to ${sender.name}:\n${url}`);
    const client = await getClient(true);
    await client.post(endpoint, { json: payload });
  } catch (error) {
    logger.warn(
      `Failed to send notification for ${url}: ${error instanceof Error ? error.message : error}`,
    );
  }
};
