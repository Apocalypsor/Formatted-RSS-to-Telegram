import feedparser
import json
import sys
import os


my_path = __file__
my_direc = os.path.dirname(__file__)

def parseUrl(url: str="https://github.com/Apocalypsor/Formatted-RSS-to-Telegram/commits/main.atom"):
    d = feedparser.parse(url)["entries"]

    file_name = url.replace("https://", "").replace("http://", "").replace("/", "_")
    with open(os.path.join(my_direc, f"{file_name}.json"), "w", encoding="UTF-8") as t:
        json.dump(d, t, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    if len(sys.argv) == 1:
        parseUrl()
    elif len(sys.argv) == 2:
        parseUrl(sys.argv[1])
    else:
        for u in sys.argv[1:]:
            parseUrl(u)
