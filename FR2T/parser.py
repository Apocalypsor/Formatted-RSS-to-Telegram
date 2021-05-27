import feedparser


def rssParser(url: str, user_agent: str):
    return feedparser.parse(url, agent=user_agent)["entries"]


def objParser(obj: dict, url: str):
    paths = url.split(".")

    for p in paths:
        if p.isdigit():
            p = int(p)

        obj = obj[p]

    return obj
