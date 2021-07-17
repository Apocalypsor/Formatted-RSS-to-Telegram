import feedparser
import morss


def rssParser(url: str, user_agent: str):
    return feedparser.parse(url, agent=user_agent)["entries"]


def rssFullParser(url: str):
    i = 0
    while i < 5:
        try:
            xml_string = morss.process(url)
            break
        except Exception:
            i += 1
    else:
        print(f"Error parsing: {url}")
        xml_string = {"entries": []}

    return feedparser.parse(xml_string)["entries"]


def objParser(obj: dict, url: str):
    paths = url.split(".")

    for p in paths:
        if p.isdigit():
            p = int(p)

        obj = obj[p]

    return obj
