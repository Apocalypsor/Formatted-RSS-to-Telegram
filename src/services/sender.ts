import { getClient } from "@clients/ky";
import type { Telegram } from "@config";
import { config } from "@config";
import { TELEGRAM_API_BASE } from "@consts";
import {
  FailedToEditMessageError,
  MessageNotFoundError,
  SendMessageFailedError,
} from "@errors";
import { logger } from "@utils";
import { HTTPError } from "ky";
import {
  buildEditCaptionRequest,
  buildEditTextRequest,
  buildSendRequest,
  type MediaItem,
} from "./telegram-request";

interface TelegramResponse {
  ok?: boolean;
  result?: { message_id?: number } | { message_id?: number }[];
}

const tgEndpoint = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}${token}/${method}`;

export const getSender = (sender: string): Telegram | undefined => {
  return config.telegram.find((s) => s.name === sender);
};

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
  } catch (e) {
    const desc = await getTelegramErrorDescription(e);
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

    return throwEditError(e, messageId, sender, desc);
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
