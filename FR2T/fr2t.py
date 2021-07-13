import copy
import copyreg
import datetime
import hashlib
import os
import re
import ssl
import time
from multiprocessing import Pool

import yaml
from jinja2 import Template
from pymongo import MongoClient

from .parser import rssParser, objParser
from .sender import editToTelegram, sendToTelegram
from .utils import escapeAll, escapeText


class FR2T:
    def __init__(self, config_path, rss_path):
        self.config_path = config_path
        self.rss_path = rss_path
        self.loadConfig()

    def loadConfig(self):
        with open(self.rss_path, "r", encoding="UTF-8") as c:
            self.config = yaml.safe_load(c)

        with open(self.config_path, "r", encoding="UTF-8") as c:
            rss_config = yaml.safe_load(c)

            self.database_url = os.getenv("DATABASE") or rss_config["database_url"]
            self.expire_time = (
                os.getenv("EXPIRE_TIME") or rss_config.get("expire_time") or "30d"
            )
            self.user_agent = (
                os.getenv("USER-AGENT")
                or rss_config.get("user-agent")
                or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
            )

            self.telegram = rss_config["telegram"]

            telegram_update = {}
            for up in self.telegram:
                up_v = os.getenv("TG_" + up.upper())
                if up_v:
                    telegram_update[up] = up_v

            self.telegram.update(telegram_update)

            self.telegram["disable_notification"] = (
                self.telegram.get("disable_notification") or "false"
            )
            self.telegram["disable_web_page_preview"] = (
                self.telegram.get("disable_web_page_preview") or "false"
            )
            self.telegram["parse_mode"] = (
                self.telegram.get("parse_mode") or "MarkdownV2"
            )

    def run(self):
        def saveSSLContext(obj):
            return obj.__class__, (obj.protocol,)

        copyreg.pickle(ssl.SSLContext, saveSSLContext)

        client = MongoClient(self.database_url)
        db = client["RSS"]

        all_sub = db.list_collection_names()

        tmp_rss = []

        for r in self.config["rss"]:
            url = r.get("url")
            new_sub = r["name"] not in all_sub
            if isinstance(url, str):
                r["new_sub"] = new_sub
                tmp_rss.append(r)
            elif isinstance(url, list):
                for u in url:
                    tmp_r = copy.deepcopy(r)
                    tmp_r["url"] = u
                    tmp_r["new_sub"] = new_sub
                    tmp_rss.append(tmp_r)

        args = [(r, self.telegram, self.database_url, self.user_agent) for r in tmp_rss]

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
            hours = int(self.expire_time.strip("h"))

        expired_time = now_time - datetime.timedelta(days=days, hours=hours)
        expired_timestamp = datetime.datetime.timestamp(expired_time)

        deleted_num = 0
        client = MongoClient(self.database_url)
        db = client["RSS"]
        col_list = db.list_collection_names()
        for col_name in col_list:
            print(f"开始清理: {col_name}")
            col = db[col_name]
            purge_rule = {"create_time": {"$lt": expired_timestamp}}

            deleted_result = col.delete_many(purge_rule)
            deleted_num += deleted_result.deleted_count

        print(f"已删除 {deleted_num} 个记录！")


def mixInput(mix_args):
    runProcess(*mix_args)


def runProcess(rss, telegram, database_url, user_agent):
    client = MongoClient(database_url)
    db = client["RSS"]
    url = rss["url"]

    new_sub = rss["new_sub"]

    rss_content = rssParser(url, user_agent)
    if not rss_content:
        expired_url = db["Expire"].find_one({"url": url})
        if expired_url:
            if expired_url["expired"] > 10:
                msg = escapeText(telegram["parse_mode"], url)
                print(f"订阅 {url} 已失效")
                sendToTelegram(telegram, f"订阅 {msg} 已失效\n\n\#提醒")
            else:
                db["Expire"].update_one(
                    {"_id": expired_url["_id"]},
                    {"$set": {"expired": expired_url["expired"] + 1}},
                )
        else:
            db["Expire"].insert_one({"url": url, "expired": 1})
    else:
        db["Expire"].update_one(
            {"url": url},
            {"$set": {"expired": 0}},
        )
        for content in rss_content:
            result = {}

            if rss.get("rules"):
                for rule in rss["rules"]:
                    obj = objParser(content, rule["obj"])

                    if not rule.get("type") or rule["type"] == "regex":
                        matcher = re.compile(rule["matcher"])
                        matched = matcher.search(obj)

                        if len(matched.groups()) == 1:
                            matched = matched.groups()[0]
                        else:
                            tmp_matched = list(matched.groups())
                            tmp_matched.insert(0, matched.group())
                            matched = tmp_matched

                        result[rule["dest"]] = matched
                    elif rule["type"] == "func":
                        loc = locals()
                        tmp_func = rule["matcher"] + "\ntmp_return = func(obj)\n"
                        exec(tmp_func)
                        result[rule["dest"]] = loc["tmp_return"]

            send = True

            if rss.get("filters"):
                for filter in rss["filters"]:
                    obj = objParser(content, filter["obj"])
                    if re.search(filter["matcher"], obj):
                        send = False

            if send:
                template = Template(rss["text"])

                args = dict(
                    **result, **content, rss_name=rss["name"], rss_url=rss["url"]
                )
                escapeAll(telegram["parse_mode"], args)

                text = template.render(args)

                id1_hash = hashlib.md5(url.encode()).hexdigest()

                id2 = content.get("id") or content.get("guid") or content.get("link")
                id2_hash = hashlib.md5(id2.encode()).hexdigest()

                id = id1_hash + id2_hash

                tmp_tg = copy.deepcopy(telegram)
                if rss.get("telegram"):
                    tmp_tg.update(rss["telegram"])

                handleText(rss["name"], id, text, tmp_tg, db, new_sub)


def handleText(name, id, text, tg, db, new_sub=False):
    text_hash = hashlib.md5(text.encode()).hexdigest()

    if not db[name].find_one({"text": text_hash}):

        id_posted = db[name].find_one({"id": id})
        if id_posted:
            if id_posted["message"] != -1:
                edit_result = editToTelegram(tg, id_posted["message"], text)
                if edit_result == 2:
                    db[name].update_one(
                        {"_id": id_posted["_id"]},
                        {"$set": {"text": text_hash, "edit_time": time.time()}},
                    )

                    print(
                        "Edited 1 message: ID {} TEXT {} in {}".format(
                            id_posted["message"], text_hash, name
                        )
                    )
                elif edit_result == 1:
                    db[name].update_one(
                        {"_id": id_posted["_id"]},
                        {
                            "$set": {
                                "message": -1,
                                "text": text_hash,
                                "edit_time": time.time(),
                            }
                        },
                    )

                    print(
                        "Edited 1 message: ID {} TEXT {} in {} (doesn't exist)".format(
                            id_posted["message"], text_hash, name
                        )
                    )
        else:
            if new_sub:
                message_id = -1
            else:
                message_id = sendToTelegram(tg, text)

            if message_id:
                db[name].insert_one(
                    {
                        "id": id,
                        "message": message_id,
                        "text": text_hash,
                        "create_time": time.time(),
                        "edit_time": time.time(),
                    }
                )

                print(f"Sent 1 message: {text_hash} in {name}")
