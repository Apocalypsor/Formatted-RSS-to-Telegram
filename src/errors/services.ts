/**
 * sender.ts errors
 */

export class SenderNotFoundError extends Error {
    constructor() {
        super(`Sender not found`);
        this.name = "SenderNotFoundError";
    }
}

export class SendMessageFailedError extends Error {
    constructor(sender: string) {
        super(`Failed to send message to ${sender}`);
        this.name = "SendMessageFailedError";
    }
}

export class MessageNotFoundError extends Error {
    constructor(messageId: bigint, sender: string) {
        super(`Message ${messageId} not found on ${sender}`);
        this.name = "MessageNotFoundError";
    }
}

export class FailedToEditMessageError extends Error {
    constructor(messageId: bigint, sender: string) {
        super(`Failed to edit message ${messageId} on ${sender}`);
        this.name = "FailedToEditMessageError";
    }
}
