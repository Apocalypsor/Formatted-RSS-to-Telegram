import type { Telegram } from "@config";
import { config } from "@config";
import {
    FailedToEditMessageError,
    MessageNotFoundError,
    SenderNotFoundError,
    SendMessageFailedError,
} from "@errors";
import { getClient, logger } from "@utils";
import { AxiosError } from "axios";

import { MediaType } from "@consts";

const getSender = (sender: string): Telegram | undefined => {
    return config.telegram.find((s) => s.name === sender);
};

const send = async (
    sender: Telegram | undefined,
    text: string,
    initialized: boolean = true,
    mediaUrls?: {
        type: MediaType;
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
        let payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        let endpoint: string = "";

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
                endpoint = `https://api.telegram.org/bot${sender.token}/sendMediaGroup`;
            } else if (mediaUrls.length === 1 && mediaUrls[0]) {
                sendByText = false;
                payload = {
                    chat_id: sender.chatId,
                    caption: text,
                    parse_mode: sender.parseMode,
                    disable_notification: sender.disableNotification,
                };
                payload[mediaUrls[0].type] = mediaUrls[0].url;
                endpoint = `https://api.telegram.org/bot${sender.token}/send${
                    mediaUrls[0].type.charAt(0).toUpperCase() +
                    mediaUrls[0].type.slice(1)
                }`;
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
            endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        }

        logger.debug(
            `Sending ${
                mediaUrls && mediaUrls.length > 0 ? "media group" : "message"
            } to ${sender.name}:\n${JSON.stringify(payload)}`,
        );

        const client = await getClient();
        const resp = await client.post(endpoint, payload);

        if (resp && resp?.data.ok) {
            const messageId = BigInt(
                // there might be a group of messages returned
                resp.data.result.message_id || resp.data.result[0].message_id,
            );
            logger.info(`Message ${messageId} sent to ${sender.name}.`);
            return messageId;
        } else {
            throw new SendMessageFailedError(sender.name);
        }
    }
};

const editText = async (sender: Telegram, messageId: bigint, text: string) => {
    const endpoint = `https://api.telegram.org/bot${sender.token}/editMessageText`;
    const payload = {
        chat_id: sender.chatId,
        message_id: messageId,
        text: text,
        parse_mode: sender.parseMode,
        disable_web_page_preview: sender.disableWebPagePreview,
        disable_notification: sender.disableNotification,
    };
    const client = await getClient();
    const resp = await client.post(endpoint, payload);
    return resp.data.ok;
};

const editCaption = async (
    sender: Telegram,
    messageId: bigint,
    caption: string,
) => {
    const endpoint = `https://api.telegram.org/bot${sender.token}/editMessageCaption`;
    const payload = {
        chat_id: sender.chatId,
        message_id: messageId,
        caption: caption,
        parse_mode: sender.parseMode,
    };
    const client = await getClient();
    const resp = await client.post(endpoint, payload);
    return resp.data.ok;
};

const edit = async (sender: Telegram, messageId: bigint, text: string) => {
    if (!sender) {
        throw new SenderNotFoundError();
    } else {
        try {
            try {
                if (await editText(sender, messageId, text)) {
                    logger.info(
                        `Message ${messageId} edited for ${sender.name}.`,
                    );
                    return;
                }
            } catch (e) {
                if (
                    e instanceof AxiosError &&
                    e.response &&
                    e.response.data.description.includes(
                        "there is no text in the message to edit",
                    )
                ) {
                    if (await editCaption(sender, messageId, text)) {
                        logger.info(
                            `Message ${messageId} edited for ${sender.name}.`,
                        );
                        return;
                    }
                }
                throw e;
            }
        } catch (e) {
            if (!(e instanceof AxiosError) || !e.response) {
                throw e;
            } else if (
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
        const endpoint = `https://api.telegram.org/bot${sender?.token}/sendMessage`;
        const payload = {
            chat_id: config.notifyTelegramChatId,
            text: "*FR2T detected a link expired*\n\n" + url,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
        };

        logger.info(`Sending notification to ${sender?.name}:\n${url}`);
        const client = await getClient(true);
        await client.post(endpoint, payload);
    }
};

export { getSender, send, edit, notify };
