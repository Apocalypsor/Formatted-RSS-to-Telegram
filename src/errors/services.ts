/**
 * sender.ts errors
 */

class SenderNotFoundError extends Error {
    constructor() {
        super(`Sender not found`);
        this.name = "SenderNotFoundError";
    }
}

class SendMessageFailedError extends Error {
    constructor(sender: string) {
        super(`Failed to send message to ${sender}`);
        this.name = "SendMessageFailedError";
    }
}

class MessageNotFoundError extends Error {
    constructor(messageId: number, sender: string) {
        super(`Message ${messageId} not found on ${sender}`);
        this.name = "MessageNotFoundError";
    }
}

class FailedToEditMessageError extends Error {
    constructor(messageId: number, sender: string) {
        super(`Failed to edit message ${messageId} on ${sender}`);
        this.name = "FailedToEditMessageError";
    }
}

export {
    SenderNotFoundError,
    SendMessageFailedError,
    MessageNotFoundError,
    FailedToEditMessageError,
};
