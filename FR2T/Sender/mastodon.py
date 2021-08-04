import hashlib

from .base import SenderBase
from ..logging import Log
from ..utils import postData, default_user_agent

logger = Log(__name__).getlog()

class Mastodon(SenderBase):
    def send(self, text):
        url = self.config["base_url"].rstrip("/") + "/api/v1/statuses"
        headers = {
            "User-Agent": default_user_agent,
            "Authorization": "Bearer " + self.config["access_token"],
            "Idempotency-Key": hashlib.md5(text.encode()).hexdigest(),
        }

        payload = {"status": text, "sensitive": self.config["sensitive"]}

        r = postData(url, data=payload, headers=headers)

        if not r.json().get("error"):
            return int(r.json()["id"])
        else:
            logger.error("Error: failed to send the message\n{}\n{}".format(text, r.json()["error"]))
            return None
