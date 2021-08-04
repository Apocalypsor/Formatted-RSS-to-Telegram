import re
import time

from jinja2 import Template

from .base import SenderBase
from ..logging import Log
from ..utils import postData

logger = Log(__name__).getlog()


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
            logger.error("Too frequently! Sleep 30s.")
            time.sleep(30)
            self.send(text)
        else:
            logger.error(
                "Error: failed to send the message:\n{}\n{}".format(
                    text, r.json()["description"]
                )
            )
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
            logger.error(
                "Error: failed to edit the message:\n{}\n{}".format(
                    text, r.json()["description"]
                )
            )
            return 0

    def escapeTemplate(self, text):
        if self.config["parse_mode"].lower() == "markdownv2":
            escaped_chara = (">", "#", "+", "-", "=", "|", "{", "}", ".", "!")

            template_out = re.split("{{.+?}}|{%.+?%}", text)
            template_in = re.findall("{{.+?}}|{%.+?%}", text)
            template_in.append("")

            for tp in range(len(template_out)):
                for e in escaped_chara:
                    template_out[tp] = template_out[tp].replace(e, "\\" + e)

            text = "".join(
                [template_out[t] + template_in[t] for t in range(len(template_out))]
            )

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
                obj[o] = self.escapeAll(obj[o])
            return obj

        elif isinstance(obj, dict):
            for k, v in obj.items():
                obj[k] = self.escapeAll(v)
            return obj
