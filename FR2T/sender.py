import time

from .utils import postData


def sendToTelegram(tg, text):
    url = "https://api.telegram.org/bot" + tg["token"] + "/sendMessage"
    payload = {
        "chat_id": tg["chat_id"],
        "text": text,
        "parse_mode": tg["parse_mode"],
        "disable_web_page_preview": tg["disable_web_page_preview"],
        "disable_notification": tg["disable_notification"],
    }

    r = postData(url, data=payload)

    if r.json()["ok"]:
        return r.json()["result"]["message_id"]
    elif r.json()["error_code"] == 429:
        print("\nToo frequently! Sleep 30s.\n")
        time.sleep(30)
        sendToTelegram(tg, text)
    else:
        print("\nError: failed to sending message:")
        print(text)
        print(r.json()["description"] + "\n")
        return False


def editToTelegram(tg, message_id, text):
    url = "https://api.telegram.org/bot" + tg["token"] + "/editMessageText"
    payload = {
        "chat_id": tg["chat_id"],
        "message_id": message_id,
        "text": text,
        "parse_mode": tg["parse_mode"],
        "disable_web_page_preview": tg["disable_web_page_preview"],
    }

    r = postData(url, data=payload)

    if r.json()["ok"] or "exactly the same" in r.json()["description"]:
        return True
    else:
        return False
