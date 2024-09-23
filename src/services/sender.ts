import { config } from "@config/config";
import { Telegram } from "@config/interfaces/config.interfaces";
import { getClient } from "@utils/client";
import logger from "@utils/logger";
import { AxiosError } from "axios";
import {
    FailedToEditMessageError,
    MessageNotFoundError,
    SenderNotFoundError,
    SendMessageFailedError,
} from "errors/services";

const getSender = (sender: string): Telegram | undefined => {
    return config.telegram.find((s) => s.name === sender);
};

const send = async (
    sender: Telegram | undefined,
    text: string,
    initialized: boolean = true,
): Promise<number | undefined> => {
    if (!sender) {
        throw new SenderNotFoundError();
    } else if (!initialized || process.env.FIRST_RUN === "true") {
        logger.info(
            `Skipping message to ${sender.name} because of initialization.`,
        );
        return -1;
    } else {
        const endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        const payload = {
            chat_id: sender.chatId,
            text: text,
            parse_mode: sender.parseMode,
            disable_web_page_preview: sender.disableWebPagePreview,
            disable_notification: sender.disableNotification,
        };

        logger.debug(
            `Sending message to ${sender.name}:\n${JSON.stringify(payload)}`,
        );

        const resp = await getClient(true).post(endpoint, payload);

        if (resp.data.ok) {
            const messageId = parseInt(resp.data.result.message_id);
            logger.info(`Message ${messageId} sent to ${sender.name}.`);
            return messageId;
        } else {
            throw new SendMessageFailedError(sender.name);
        }
    }
};

const edit = async (sender: Telegram, messageId: number, text: string) => {
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
