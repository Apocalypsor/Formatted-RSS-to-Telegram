import {
  MEDIA_TYPE,
  TELEGRAM_API_BASE,
  TELEGRAM_MEDIA_GROUP_LIMIT,
} from "@consts";
import type { Telegram } from "../config/schema";

export interface MediaItem {
  type: MEDIA_TYPE;
  url: string;
}

export interface TgRequest {
  endpoint: string;
  payload: Record<string, unknown>;
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
