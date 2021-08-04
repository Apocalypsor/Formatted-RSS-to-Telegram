import os

from .Sender import *
from .utils import dictDeleteNone

default_sender = {
    "telegram": {
        "token": None,
        "chat_id": None,
        "disable_notification": "false",
        "disable_web_page_preview": "false",
        "parse_mode": "MarkdownV2",
    },
    "mastodon": {
        "base_url": None,
        "client_id": None,
        "client_secret": None,
        "access_token": None,
        "sensitive": "false",
    },
}

sender_env_name = {"telegram": "TG_", "mastodon": "MASTODON_"}


def loadSender(config):
    sender = default_sender

    for sd in default_sender:
        sender[sd].update(dictDeleteNone(config[sd]))

        tmp_update = {}
        for up in sender[sd]:
            up_v = os.getenv(sender_env_name[sd] + up.upper())
            if up_v:
                tmp_update[up] = up_v

        sender[sd].update(tmp_update)

    return sender


def validateSender(sender):
    for send in sender:
        if send == "telegram":
            if not (sender[send].get("token") and sender[send].get("chat_id")):
                sender[send] = None

        if send == "mastodon":
            if not (
                    sender[send].get("base_url")
                    and sender[send].get("client_id")
                    and sender[send].get("client_secret")
            ):
                sender[send] = None

    sender = dictDeleteNone(sender)

    if not sender:
        return "no_valid", sender
    elif len(sender.keys()) == 1:
        return list(sender.keys())[0], sender
    else:
        return "multiple_valid", sender


def initSender(name, config):
    if name == "telegram":
        return telegram.Telegram(config)

    if name == "mastodon":
        return mastodon.Mastodon(config)


def notify(token, chat_id, text):
    tg = telegram.Telegram(
        {
            "token": token,
            "chat_id": chat_id,
            "disable_notification": "false",
            "disable_web_page_preview": "true",
            "parse_mode": "Markdown",
        }
    )

    tg.send(f"FR2T: {text}\n\n提醒")
