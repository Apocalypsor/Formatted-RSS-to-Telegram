const client = require('./client');
const {config} = require('./config');
const logger = require("./logger");
const {editStatus} = require("../model/status");

async function send(sender, text) {
    const targetSender = config.telegram.find(s => s.name === sender);
    if (!targetSender) {
        logger.error(`Sender ${sender} not found, skipping.`);
    } else {
        const endpoint = `https://api.telegram.org/bot${targetSender.token}/sendMessage`;
        const payload = {
            chat_id: targetSender.chatId,
            text: text,
            parse_mode: targetSender.parseMode,
            disable_web_page_preview: targetSender.disableWebPagePreview,
            disable_notification: targetSender.disableNotification,
        }

        const resp = await client.post(endpoint, payload);
        let messageId;

        if (resp.data.ok) {
            logger.info(`Message sent to ${sender}.`);
            messageId = parseInt(resp.data.result.message_id);
        } else if (resp.data.error_code === 429) {
            logger.error(`Telegram API rate limit exceeded, sleeping 30s.`);
            setTimeout(async () => {
                messageId = await send(sender, text);
            }, 30000);
        } else {
            logger.error(`Telegram API error: ${resp.data}`);
        }

        return messageId;
    }
}

async function edit(sender, text, messageId) {
    const targetSender = config.telegram.find(s => s.name === sender);
    if (!targetSender) {
        logger.error(`Sender ${sender} not found, skipping.`);
    } else {
        const endpoint = `https://api.telegram.org/bot${targetSender.token}/editMessageText`;
        const payload = {
            chat_id: targetSender.chatId,
            message_id: messageId,
            text: text,
            parse_mode: targetSender.parseMode,
            disable_web_page_preview: targetSender.disableWebPagePreview,
        }

        const resp = await client.post(endpoint, payload);
        let resStatus;

        if (resp.data.ok || resp.data.description.includes('exactly the same')) {
            logger.info(`Message edited on ${sender}.`);
            resStatus = editStatus.SUCCESS;
        } else if (resp.data.error_code === 429) {
            logger.error(`Telegram API rate limit exceeded, sleeping 30s.`);
            setTimeout(async () => {
                resStatus = await edit(sender, text, messageId);
            }, 30000);
        } else if (
            resp.data.description.includes('message to edit not found') ||
            resp.data.description.includes('MESSAGE_ID_INVALID')
        ) {
            logger.error(`Message not found on ${sender}, skipping.`);
            resStatus = editStatus.NOT_FOUND;
        } else {
            logger.error(`Telegram API error: ${resp.data}`);
            resStatus = editStatus.ERROR;
        }

        return resStatus;
    }
}

module.exports = {
    send,
    edit,
}
