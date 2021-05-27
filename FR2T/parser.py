import feedparser


def rssParser(url: str, user_agent: str):
    d = feedparser.parse(url, agent=user_agent)["entries"]

    return d


def objParser(obj: dict, url: str):
    paths = url.split(".")

    for p in paths:
        obj = obj[p]

    return obj
