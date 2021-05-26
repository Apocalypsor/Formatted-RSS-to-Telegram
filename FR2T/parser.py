import feedparser


def rssParser(url: str):
    d = feedparser.parse(url)["entries"]

    return d


def objParser(obj: dict, url: str):
    paths = url.split(".")

    for p in paths:
        obj = obj[p]

    return obj
