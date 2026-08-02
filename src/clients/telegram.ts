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
import { type KyClient, kyClient } from "./ky";

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

export class TelegramClient {
  constructor(
    private readonly http: Pick<KyClient, "getInstance"> = kyClient,
  ) {}

  buildSendRequest(
    sender: Telegram,
    text: string,
    mediaUrls?: MediaItem[],
  ): TgRequest {
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
        return this.buildSingleMediaRequest(sender, text, mediaUrls[0]);
      }
      if (mediaUrls.length <= TELEGRAM_MEDIA_GROUP_LIMIT) {
        return this.buildMediaGroupRequest(sender, text, mediaUrls);
      }
    }

    return this.buildTextRequest(sender, text);
  }

  buildEditTextRequest(
    sender: Telegram,
    messageId: number,
    text: string,
  ): TgRequest {
    return sender.parseMode === "RichHTML"
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
  }

  buildEditCaptionRequest(
    sender: Telegram,
    messageId: number,
    caption: string,
  ): TgRequest {
    return {
      endpoint: tgEndpoint(sender.token, "editMessageCaption"),
      payload: {
        chat_id: sender.chatId,
        message_id: messageId,
        caption,
        parse_mode: sender.parseMode,
      },
    };
  }

  buildExpirationNotificationRequest(
    sender: Telegram,
    chatId: number,
    url: string,
  ): TgRequest {
    return {
      endpoint: tgEndpoint(sender.token, "sendMessage"),
      payload: {
        chat_id: chatId,
        text: `*FR2T detected a link expired*\n\n${url}`,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      },
    };
  }

  async send(
    sender: Telegram,
    text: string,
    mediaUrls?: MediaItem[],
  ): Promise<number> {
    const { endpoint, payload } = this.buildSendRequest(
      sender,
      text,
      mediaUrls,
    );

    logger.debug(
      `Sending ${
        mediaUrls && mediaUrls.length > 0 ? "media group" : "message"
      } to ${sender.name}:\n${JSON.stringify(payload)}`,
    );

    const client = await this.http.getInstance();
    const resp = await client
      .post(endpoint, { json: payload })
      .json<TelegramResponse>();

    if (!resp?.ok) {
      throw new SendMessageFailedError(sender.name);
    }

    const messageId = this.parseMessageId(resp, sender.name);
    logger.info(`Message ${messageId} sent to ${sender.name}.`);
    return messageId;
  }

  async edit(
    sender: Telegram,
    messageId: number,
    text: string,
  ): Promise<number> {
    try {
      const edited = await this.editText(sender, messageId, text);
      if (edited) {
        logger.info(`Message ${messageId} edited for ${sender.name}.`);
      }
      return messageId;
    } catch (error) {
      const desc = await this.getTelegramErrorDescription(error);
      if (desc?.includes("there is no text in the message to edit")) {
        if (sender.parseMode === "RichHTML") {
          const replacementId = await this.send(sender, text);
          logger.info(
            `Message ${replacementId} sent as a RichHTML replacement for ${messageId} on ${sender.name}.`,
          );
          return replacementId;
        }

        try {
          const edited = await this.editCaption(sender, messageId, text);
          if (edited) {
            logger.info(`Message ${messageId} edited for ${sender.name}.`);
          }
          return messageId;
        } catch (captionError) {
          return this.throwEditError(captionError, messageId, sender);
        }
      }

      return this.throwEditError(error, messageId, sender, desc);
    }
  }

  async sendExpirationNotification(
    sender: Telegram,
    chatId: number,
    url: string,
  ): Promise<void> {
    const { endpoint, payload } = this.buildExpirationNotificationRequest(
      sender,
      chatId,
      url,
    );
    try {
      logger.info(`Sending notification to ${sender.name}:\n${url}`);
      const client = await this.http.getInstance(true);
      await client.post(endpoint, { json: payload });
    } catch (error) {
      logger.warn(
        `Failed to send notification for ${url}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private buildTextRequest(sender: Telegram, text: string): TgRequest {
    return {
      endpoint: tgEndpoint(sender.token, "sendMessage"),
      payload: {
        chat_id: sender.chatId,
        text,
        parse_mode: sender.parseMode,
        disable_web_page_preview: sender.disableWebPagePreview,
        disable_notification: sender.disableNotification,
      },
    };
  }

  private buildSingleMediaRequest(
    sender: Telegram,
    text: string,
    media: MediaItem,
  ): TgRequest {
    return {
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
    };
  }

  private buildMediaGroupRequest(
    sender: Telegram,
    text: string,
    mediaUrls: MediaItem[],
  ): TgRequest {
    return {
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
    };
  }

  private parseMessageId(resp: TelegramResponse, senderName: string): number {
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
  }

  private async editText(
    sender: Telegram,
    messageId: number,
    text: string,
  ): Promise<boolean | undefined> {
    const { endpoint, payload } = this.buildEditTextRequest(
      sender,
      messageId,
      text,
    );
    const client = await this.http.getInstance();
    const resp = await client
      .post(endpoint, { json: payload })
      .json<TelegramResponse>();
    return resp.ok;
  }

  private async editCaption(
    sender: Telegram,
    messageId: number,
    caption: string,
  ): Promise<boolean | undefined> {
    const { endpoint, payload } = this.buildEditCaptionRequest(
      sender,
      messageId,
      caption,
    );
    const client = await this.http.getInstance();
    const resp = await client
      .post(endpoint, { json: payload })
      .json<TelegramResponse>();
    return resp.ok;
  }

  private async getTelegramErrorDescription(
    error: unknown,
  ): Promise<string | null> {
    if (error instanceof HTTPError) {
      const data = error.data as { description?: unknown } | undefined;
      return typeof data?.description === "string" ? data.description : null;
    }
    return null;
  }

  private async throwEditError(
    error: unknown,
    messageId: number,
    sender: Telegram,
    knownDescription?: string | null,
  ): Promise<never> {
    const desc =
      knownDescription ?? (await this.getTelegramErrorDescription(error));
    if (!desc) throw error;

    if (
      desc.includes("message to edit not found") ||
      desc.includes("MESSAGE_ID_INVALID")
    ) {
      throw new MessageNotFoundError(messageId, sender.name);
    }
    throw new FailedToEditMessageError(messageId, sender.name);
  }
}

export const telegramClient = new TelegramClient();
