import copy
import datetime
import hashlib
import os
import random
import re
import time
from multiprocessing import Pool

from jinja2 import Template
from pymongo import MongoClient

from .parser import rssParser, rssFullParser, objParser
from .sender import editToTelegram, sendToTelegram
from .telegraph import generateTelegraph
from .utils import default_user_agent, escapeAll, escapeText, execFunc, pickleSSL


class FR2T:
    def __init__(self, config, rss):
        self.rss = rss

        self.database_url = os.getenv("DATABASE") or config["database_url"]
        self.expire_time = (
                os.getenv("EXPIRE_TIME") or config["expire_time"] or "30d"
        )
        self.user_agent = (
                os.getenv("USER-AGENT")
                or config.get("user-agent")
                or default_user_agent
        )

        self.telegraph_access_token = (
                os.getenv("TELEGRAPH_ACCESS_TOKEN") or config["telegraph_access_token"]
        )

        self.telegram = config["telegram"]

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
        self.telegram["parse_mode"] = self.telegram.get("parse_mode") or "MarkdownV2"

    def run(self):
        pickleSSL()

        client = MongoClient(self.database_url)
        db = client["RSS"]

        all_sub = db.list_collection_names()

        tmp_rss = []

        for r in self.rss["rss"]:
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

        args = [
            (
                r,
                self.telegram,
                self.database_url,
                self.user_agent,
                self.telegraph_access_token,
            )
            for r in tmp_rss
        ]

        with Pool(8) as p:
            p.map(RunProcess, args)

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


class RunProcess:
    def __init__(self, mix_args):
        (
            self.rss,
            self.telegram,
            self.database_url,
            self.user_agent,
            self.telegraph_access_token,
        ) = mix_args

        self.url = self.rss["url"]
        self.new_sub = self.rss["new_sub"]

        pickleSSL()
        self.runProcess()

    def runProcess(self):
        client = MongoClient(self.database_url)
        db = client["RSS"]

        if self.rss.get("fulltext"):
            rss_content = rssFullParser(self.url)
        else:
            rss_content = rssParser(self.url, self.user_agent)

        if not rss_content:
            self.handleExpire()
        else:
            db["Expire"].update_one(
                {"url": self.url},
                {"$set": {"expired": 0}},
            )

            for content in rss_content:
                if self.handleFilter(content):
                    result = self.handleMatcher(content)

                    id = self.handleID(content)

                    client = MongoClient(self.database_url)
                    db = client["RSS"]
                    id_posted = db[self.rss["name"]].find_one({"id": id})

                    telegraph_url, telegraph_content = self.handleTelegraph(
                        id_posted,
                        content,
                    )

                    if telegraph_url != False:
                        result["telegraph"] = telegraph_url

                        template = Template(self.rss["text"])

                        args = dict(
                            **result,
                            **content,
                            rss_name=self.rss["name"],
                            rss_url=self.rss["url"],
                            rss_content=telegraph_content,
                        )
                        escapeAll(self.telegram["parse_mode"], args)

                        text = template.render(args)

                        tmp_tg = copy.deepcopy(self.telegram)
                        if self.rss.get("telegram"):
                            tmp_tg.update(self.rss["telegram"])

                        self.handleText(id, id_posted, text, tmp_tg, telegraph_url)

    def handleText(self, id, id_posted, text, tg, telegraph_url=""):
        client = MongoClient(self.database_url)
        db = client["RSS"]

        name = self.rss["name"]
        text_hash = hashlib.md5(text.encode()).hexdigest()

        if id_posted:
            if id_posted["text"] != text_hash and id_posted["message"] != -1:
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
                    return

            if telegraph_url:
                db[name].update_one(
                    {"_id": id_posted["_id"]},
                    {
                        "$set": {
                            "telegraph_url": telegraph_url,
                        }
                    },
                )

        else:
            if self.new_sub:
                message_id = -1
            else:
                message_id = sendToTelegram(tg, text)

            if message_id:
                insert_data = {
                    "id": id,
                    "message": message_id,
                    "text": text_hash,
                    "create_time": time.time(),
                    "edit_time": time.time(),
                }

                if telegraph_url:
                    insert_data["telegraph_url"] = telegraph_url

                db[name].insert_one(insert_data)

                print(f"Sent 1 message: {text_hash} in {name}")

    def handleExpire(self):
        url = self.url
        client = MongoClient(self.database_url)
        db = client["RSS"]

        expired_url = db["Expire"].find_one({"url": url})
        if expired_url:
            if expired_url["expired"] > 100:
                msg = escapeText(self.telegram["parse_mode"], url)
                print(f"订阅 {url} 已失效")
                sendToTelegram(self.telegram, f"订阅 {msg} 已失效\n\n\#提醒")
            else:
                db["Expire"].update_one(
                    {"_id": expired_url["_id"]},
                    {"$set": {"expired": expired_url["expired"] + 1}},
                )
        else:
            db["Expire"].insert_one({"url": url, "expired": 1})

    def handleFilter(self, content):
        if self.rss.get("filters"):
            for filter in self.rss["filters"]:
                obj = objParser(content, filter["obj"])
                if filter.get("type") == "in":
                    if not re.search(filter["matcher"], obj):
                        return False
                else:
                    if re.search(filter["matcher"], obj):
                        return False

        return True

    def handleMatcher(self, content):
        result = {}

        if self.rss.get("rules"):
            for rule in self.rss["rules"]:
                obj = objParser(content, rule["obj"])

                if not rule.get("type") or rule["type"] == "regex":
                    matcher = re.compile(rule["matcher"])
                    matched = matcher.search(obj)

                    # If only one match is made, the match is returned,
                    # otherwise the matching string and all matches are returned
                    if len(matched.groups()) == 1:
                        matched = matched.groups()[0]
                    else:
                        tmp_matched = list(matched.groups())
                        tmp_matched.insert(0, matched.group())
                        matched = tmp_matched

                    result[rule["dest"]] = matched

                elif rule["type"] == "func":
                    result[rule["dest"]] = execFunc(obj, rule["matcher"])

        return result

    def handleID(self, content):
        id1_hash = hashlib.md5(self.url.encode()).hexdigest()

        id2 = content.get("id") or content.get("guid") or content.get("link")
        id2_hash = hashlib.md5(id2.encode()).hexdigest()

        return id1_hash + id2_hash

    def handleTelegraph(self, id_posted, content):
        def __generateTelegraph(
                title, telegraph_author, content, telegraph_access_token
        ):
            time.sleep(random.randint(1, 15))

            telegraph_url = generateTelegraph(
                telegraph_access_token,
                title,
                telegraph_author,
                content,
            )

            return telegraph_url

        telegraph_url = telegraph_content = ""

        if self.rss.get("telegraph") and self.telegraph_access_token:
            if self.rss.get("content"):
                obj = objParser(content, self.rss["content"]["obj"])
                telegraph_content = execFunc(obj, self.rss["content"]["matcher"])
            else:
                telegraph_content = content["content"][0]["value"]

            telegraph_author = content.get("author") or "Anonymous"

            telegraph_author_title = content["title"]

            if id_posted:
                if not id_posted.get("telegraph_url"):
                    telegraph_url = __generateTelegraph(
                        telegraph_author_title,
                        telegraph_author,
                        telegraph_content,
                        self.telegraph_access_token,
                    )
                else:
                    telegraph_url = id_posted["telegraph_url"]
            else:
                telegraph_url = __generateTelegraph(
                    telegraph_author_title,
                    telegraph_author,
                    telegraph_content,
                    self.telegraph_access_token,
                )

        return telegraph_url, telegraph_content
