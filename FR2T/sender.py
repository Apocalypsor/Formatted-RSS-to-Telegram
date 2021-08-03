import os
import time

from jinja2 import Template

from .utils import dictDeleteNone, postData

default_sender = {
    "telegram": {
        "token": None,
        "chat_id": None,
        "disable_notification": "false",
        "disable_web_page_preview": "false",
        "parse_mode": "MarkdownV2",
    },
    "mastodon": {"client_id": None, "client_secret": None, "authorization_code": None},
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
                    sender[send].get("client_id") and sender[send].get("client_secret")
            ):
                sender[send] = None

    sender = dictDeleteNone(sender)

    if not sender:
        return "no_valid", sender
    elif len(sender.keys()) == 1:
        return sender.keys()[0], sender
    else:
        return "multiple_valid", sender


def initSender(name, config):
    if name == "telegram":
        return Telegram(config)


class SenderBase:
    def __init__(self, config):
        self.config = config

    def render(self, template, args):
        template = Template(template)
        msg = template.render(args)
        return msg

    def send(self, text):
        pass

    def edit(self, message_id, text):
        pass


class Telegram(SenderBase):
    def render(self, template, args):
        template = Template(self.escapeTemplate(template))
        msg = template.render(self.escapeAll(args))
        return msg

    def send(self, text):
        url = "https://api.telegram.org/bot" + self.config["token"] + "/sendMessage"
        payload = {
            "chat_id": self.config["chat_id"],
            "text": text,
            "parse_mode": self.config["parse_mode"],
            "disable_web_page_preview": self.config["disable_web_page_preview"],
            "disable_notification": self.config["disable_notification"],
        }

        r = postData(url, data=payload)

        if r.json()["ok"]:
            return int(r.json()["result"]["message_id"])
        elif r.json()["error_code"] == 429:
            print("\nToo frequently! Sleep 30s.\n")
            time.sleep(30)
            self.send(text)
        else:
            print("\nError: failed to send the message:")
            print(text)
            print(r.json()["description"] + "\n")
            return None

    def edit(self, message_id, text):
        url = "https://api.telegram.org/bot" + self.config["token"] + "/editMessageText"
        payload = {
            "chat_id": self.config["chat_id"],
            "message_id": message_id,
            "text": text,
            "parse_mode": self.config["parse_mode"],
            "disable_web_page_preview": self.config["disable_web_page_preview"],
        }

        r = postData(url, data=payload)

        if r.json()["ok"] or "exactly the same" in r.json()["description"]:
            return 2
        elif "message to edit not found" in r.json()["description"]:
            return 1
        else:
            print("\nError: failed to edit the message:")
            print(text)
            print(r.json()["description"] + "\n")
            return 0

    def escapeTemplate(self, text):
        if self.config["parse_mode"].lower() == "markdownv2":
            escaped_chara = (">", "#", "+", "-", "=", "|", "{", "}", ".", "!")

            for e in escaped_chara:
                text = text.replace(e, "\\" + e)

        return text

    def escapeText(self, text):
        escaped_chara = ()

        if self.config["parse_mode"].lower() == "markdownv2":
            escaped_chara = (
                "_",
                "*",
                "[",
                "]",
                "(",
                ")",
                "~",
                "`",
                ">",
                "#",
                "+",
                "-",
                "=",
                "|",
                "{",
                "}",
                ".",
                "!",
            )

        elif self.config["parse_mode"].lower() == "markdown":
            escaped_chara = ("_", "*", "`", "[")

        for e in escaped_chara:
            text = text.replace(e, "\\" + e)

        return text

    def escapeAll(self, obj):
        if isinstance(obj, str):
            escaped = self.escapeText(obj)
            return escaped

        elif isinstance(obj, list):
            for o in range(len(obj)):
                obj[o] = self.escapeText(obj[o])
            return obj

        elif isinstance(obj, dict):
            for k, v in obj.items():
                obj[k] = self.escapeText(v)
            return obj
