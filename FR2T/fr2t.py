from .parser import rssParser, objParser
from .utils import postData, escapeAll, escapeText
from jinja2 import Template
from pymongo import MongoClient
import datetime
import hashlib
import time
import re
import yaml
from multiprocessing import Pool
import ssl
import copyreg
import copy
import os


class FR2T:
    def __init__(self, config_path, rss_path):
        self.config_path = config_path
        self.rss_path = rss_path
        self.loadConfig()


    def loadConfig(self):
        with open(self.rss_path, "r") as c:
            self.config = yaml.safe_load(c)

        with open(self.config_path, "r") as c:
            rss_config = yaml.safe_load(c)

            self.database_url = os.environ["DATABASE"] if os.getenv("DATABASE") else rss_config["database_url"]
            self.expire_time = os.environ["EXPIRE_TIME"] if os.getenv("EXPIRE_TIME") else rss_config["expire_time"]

            self.telegram = rss_config["telegram"]
            telegram_update = {}
            for up in self.telegram:
                up_v = os.getenv("TG_" + up.upper())
                if up_v:
                    telegram_update[up] = up_v

            self.telegram.update(telegram_update)
            if not self.telegram["disable_notification"]:
                self.telegram["disable_notification"] = "false"

            if not self.telegram["disable_web_page_preview"]:
                self.telegram["disable_web_page_preview"] = "false"

            if not self.telegram["parse_mode"]:
                self.telegram["parse_mode"] = "MarkdownV2"

    def run(self):
        def save_sslcontext(obj):
            return obj.__class__, (obj.protocol,)

        copyreg.pickle(ssl.SSLContext, save_sslcontext)

        args = [(r, self.telegram, self.database_url) for r in self.config["rss"]]

        with Pool(8) as p:
            p.map(mixInput, args)

        print("Finished!")

    def purge(self):
        now_time = datetime.datetime.now()
        days = hours = 0
        if self.expire_time.endswith("y"):
            days = int(self.expire_time.strip("y")) * 365

        if self.expire_time.endswith("m"):
            days = int(self.expire_time.strip("m")) * 30

        if self.expire_time.endswith("d"):
            days = int(self.expire_time.strip("d"))

        if self.expire_time.endswith("h"):
            hours = (self.expire_time.strip("h"))

        expired_time = now_time - datetime.timedelta(days=days, hours=hours)
        expired_timestamp = datetime.datetime.timestamp(expired_time)

        deleted_num = 0
        client = MongoClient(self.database_url)
        db = client["RSS"]
        col_list = db.list_collection_names()
        for col_name in col_list:
            print(f"开始清理: {col_name}")
            col = db[col_name]
            purge_rule = {"create_time": { "$lt": expired_timestamp }}

            deleted_result = col.delete_many(purge_rule)
            deleted_num += deleted_result.deleted_count

        print(f"已删除 {deleted_num} 个记录！")


def mixInput(mix_args):
    runProcess(mix_args[0], mix_args[1], mix_args[2])


def runProcess(rss, telegram, database_url):
    client = MongoClient(database_url)
    db = client["RSS"]

    if isinstance(rss["url"], str):
        handleRSS(rss, rss["url"], telegram, db)
    elif isinstance(rss["url"], list):
        for url in set(rss["url"]):
            handleRSS(rss, url, telegram, db)
    else:
        print("{}: Error URL!".format(rss["name"]))


def handleRSS(rss, url, telegram, db):
    rss_content = rssParser(url)
    if not rss_content:
        msg = escapeText(telegram["parse_mode"], url)
        print(f"订阅 {url} 已失效")
        sendToTelegram(telegram, f"订阅 {msg} 已失效\n\n\#提醒")
    else:
        for content in rss_content:
            result = {}

            for rule in rss["rules"]:
                obj = objParser(content, rule["obj"])
                if not rule.get("type"):
                    rule["type"] = "regex"

                if rule["type"] == "regex":
                    matcher = re.compile(rule["matcher"])
                    matched = matcher.search(obj)

                    if len(matched.groups()) == 1:
                        matched = matched.groups()[0]
                    else:
                        tmp = list(matched.groups())
                        tmp.insert(0, matched.group())
                        matched = tmp

                    result[rule["dest"]] = matched
                elif rule["type"] == "func":
                    loc = locals()
                    tmp_func = rule["matcher"] + "\ntmp_return = func(obj)\n"
                    exec(tmp_func)
                    result[rule["dest"]] = loc["tmp_return"]

            template = Template(rss["text"])

            args = dict(**result, **content)
            escapeAll(telegram["parse_mode"], args)

            text = template.render(args)

            id1_hash = hashlib.md5(url.encode()).hexdigest()

            id2 = content["id"] if "id" in content else content["guid"]
            id2_hash = hashlib.md5(id2.encode()).hexdigest()

            id = id1_hash + id2_hash

            tmp_tg = copy.deepcopy(telegram)

            if rss.get("telegram"):
                tmp_tg.update(rss["telegram"])

            handleText(rss["name"], id, text, tmp_tg, db)


def handleText(name, id, text, tg, db):
    text_hash = hashlib.md5(text.encode()).hexdigest()

    text_posted = db[name].find_one({"text": text_hash})

    if not text_posted:
        time.sleep(1)

        id_posted = db[name].find_one({"id": id})
        if id_posted:
            if editToTelegram(tg, id_posted["message"], text):
                db[name].update_one(
                    {"_id": str(id_posted["_id"])},
                    {"$set": {"text": text_hash, "edit_time": time.time()}},
                )

                print("Edited 1 message: in", name)
        else:
            message_id = sendToTelegram(tg, text)
            if message_id:
                post = {
                    "id": id,
                    "message": message_id,
                    "text": text_hash,
                    "create_time": time.time(),
                    "edit_time": time.time(),
                }

                db[name].insert_one(post)

                print("Sent 1 message in:", name)


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

    if r.json()["ok"]:
        return True
    else:
        return False
