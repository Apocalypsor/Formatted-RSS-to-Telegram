import feedparser
import json

url = "https://rsshub.app/bilibili/user/bangumi/2975898"
d = feedparser.parse(url)["entries"]

with open("example.json", "w") as t:
    json.dump(d, t, indent=4, ensure_ascii=False)
