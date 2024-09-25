import { config } from "@config";
import { Telegram } from "@config/interfaces/config.interfaces";
import {
    FailedToEditMessageError,
    MessageNotFoundError,
    SenderNotFoundError,
    SendMessageFailedError,
} from "@errors/services";
import { getClient } from "@utils/client";
import logger from "@utils/logger";
import { AxiosError, AxiosResponse } from "axios";

const getSender = (sender: string): Telegram | undefined => {
    return config.telegram.find((s) => s.name === sender);
};

const send = async (
    sender: Telegram | undefined,
    text: string,
    initialized: boolean = true,
    mediaUrls?: {
        type: "photo" | "video";
        url: string;
    }[],
): Promise<bigint | undefined> => {
    if (!sender) {
        throw new SenderNotFoundError();
    } else if (!initialized || process.env.FIRST_RUN === "true") {
        logger.info(
            `Skipping message to ${sender.name} because of initialization.`,
        );
        return BigInt(-1);
    } else {
        let sendByText = true;
        let resp: AxiosResponse | null = null;
        let payload: any;
        if (mediaUrls) {
            if (mediaUrls.length > 1 && mediaUrls.length <= 10) {
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
                resp = await getClient(true).post(
                    `https://api.telegram.org/bot${sender.token}/sendMediaGroup`,
                    payload,
                );
            } else if (mediaUrls.length === 1) {
                sendByText = false;
                payload = {
                    chat_id: sender.chatId,
                    media: mediaUrls[0].url,
                    caption: text,
                    parse_mode: sender.parseMode,
                    disable_notification: sender.disableNotification,
                };
                resp = await getClient(true).post(
                    `https://api.telegram.org/bot${sender.token}/send${
                        mediaUrls[0].type.charAt(0).toUpperCase() +
                        mediaUrls[0].type.slice(1)
                    }`,
                    payload,
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
            resp = await getClient(true).post(
                `https://api.telegram.org/bot${sender.token}/sendMessage`,
                payload,
            );
        }

        logger.debug(
            `Sending ${
                mediaUrls && mediaUrls.length > 0 ? "media group" : "message"
            } to ${sender.name}:\n${JSON.stringify(payload)}`,
        );

        if (resp && resp?.data.ok) {
            const messageId = BigInt(resp.data.result.message_id);
            logger.info(`Message ${messageId} sent to ${sender.name}.`);
            return messageId;
        } else {
            throw new SendMessageFailedError(sender.name);
        }
    }
};

const edit = async (sender: Telegram, messageId: bigint, text: string) => {
    if (!sender) {
        throw new SenderNotFoundError();
    } else {
        const endpoint = `https://api.telegram.org/bot${sender.token}/editMessageText`;
        const payload = {
            chat_id: sender.chatId,
            message_id: messageId,
            text: text,
            parse_mode: sender.parseMode,
            disable_web_page_preview: sender.disableWebPagePreview,
            disable_notification: sender.disableNotification,
        };

        try {
            const resp = await getClient().post(endpoint, payload);
            if (resp.data.ok) {
                logger.info(`Message ${messageId} edited to ${sender.name}.`);
            }
        } catch (e) {
            if (!(e instanceof AxiosError) || !e.response) {
                throw e;
            }
            if (
                e.response.data.description.includes(
                    "message to edit not found",
                ) ||
                e.response.data.description.includes("MESSAGE_ID_INVALID")
            ) {
                throw new MessageNotFoundError(messageId, sender.name);
            } else {
                throw new FailedToEditMessageError(messageId, sender.name);
            }
        }
    }
};

const notify = async (url: string) => {
    if (config.telegram.length === 0 || !config.notifyTelegramChatId) {
        logger.warn(
            "No Telegram sender for notification configured, skipping.",
        );
    } else {
        const sender = config.telegram[0];
        const endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        const payload = {
            chat_id: config.notifyTelegramChatId,
            text: "*FR2T detected a link expired*\n\n" + url,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
        };

        logger.info(`Sending notification to ${sender.name}:\n${url}`);
        await getClient(true).post(endpoint, payload);
    }
};

export { getSender, send, edit, notify };
