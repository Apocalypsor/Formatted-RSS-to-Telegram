const client = require('./client');
const {config} = require('./config');
const logger = require("./logger");
const {editStatus} = require("../model/status");

function getSender(sender) {
    return config.telegram.find(s => s.name === sender);
}

async function send(sender, text) {
    if (!sender) {
        logger.error(`Sender ${sender} not found, skipping.`);
    } else {
        const endpoint = `https://api.telegram.org/bot${sender.token}/sendMessage`;
        const payload = {
            chat_id: sender.chatId,
            text: text,
            parse_mode: sender.parseMode,
            disable_web_page_preview: sender.disableWebPagePreview,
            disable_notification: sender.disableNotification,
        }

        const resp = await client.post(endpoint, payload);
        let messageId = -1;

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
        }

        let resStatus;
        try {
            const resp = await client.post(endpoint, payload);
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

module.exports = {
    getSender,
    send,
    edit,
}
