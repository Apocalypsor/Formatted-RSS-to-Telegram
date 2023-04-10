const getClient = require('./client');
const {config} = require('./config');
const logger = require("./logger");
const {editStatus} = require("../model/status");

require('dotenv').config();

function getSender(sender) {
    return config.telegram.find(s => s.name === sender);
}

async function send(sender, text) {
    if (!sender) {
        logger.error(`Sender ${sender} not found, skipping.`);
    } else if (process.env.INITIALIZE) {
        logger.info(`Skipping message to ${sender.name} because of initialization.`);
        return -1;
    } else {
        const endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        const payload = {
            chat_id: sender.chatId,
            text: text,
            parse_mode: sender.parseMode,
            disable_web_page_preview: sender.disableWebPagePreview,
            disable_notification: sender.disableNotification,
        }

        logger.debug(`Sending message to ${sender.name}:\n${JSON.stringify(payload)}`);

        const resp = await getClient().post(endpoint, payload);
        let messageId;

        if (resp.data.ok) {
            messageId = parseInt(resp.data.result.message_id);
            logger.info(`Message ${messageId} sent to ${sender.name}.`);
        }

        return messageId;
    }
}

async function edit(sender, messageId, text) {
    if (!sender) {
        logger.error(`Sender ${sender} not found, skipping.`);
    } else {
        const endpoint = `https://api.telegram.org/bot${sender.token}/editMessageText`;
        const payload = {
            chat_id: sender.chatId,
            message_id: messageId,
            text: text,
            parse_mode: sender.parseMode,
            disable_web_page_preview: sender.disableWebPagePreview,
            disable_notification: sender.disableNotification,
        }

        let resStatus;
        try {
            const resp = await getClient().post(endpoint, payload);
            if (resp.data.ok) {
                logger.info(`Message ${messageId} edited to ${sender.name}.`);
                resStatus = editStatus.SUCCESS;
            }
        } catch (e) {
            if (e.response.data.description.includes('exactly the same')) {
                resStatus = editStatus.SUCCESS;
            } else if (
                e.response.data.description.includes('message to edit not found')
                || e.response.data.description.includes('MESSAGE_ID_INVALID')
            ) {
                logger.error(`Message not found on ${sender.name}, skipping.`);
                resStatus = editStatus.NOT_FOUND;
            } else {
                logger.error(`Error editing message on ${sender.name}, skipping.`);
                resStatus = editStatus.ERROR;
            }
        }

        return resStatus;
    }
}

async function notify(url) {
    if (config.telegram.length === 0 || !config.notifyTelegramChatId) {
        logger.warn('No Telegram sender for notification configured, skipping.');
    } else {
        const sender = config.telegram[0];
        const endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        const payload = {
            chat_id: config.notifyTelegramChatId,
            text: '*FR2T detected a link expired*\n\n' + url,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
        }

        logger.info(`Sending notification to ${sender.name}:\n${url}`);
        await getClient().post(endpoint, payload);
    }
}

module.exports = {
    getSender,
    send,
    edit,
    notify
}
