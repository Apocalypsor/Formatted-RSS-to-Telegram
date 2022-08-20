import demoji
import feedparser
import morss
from bs4 import BeautifulSoup

from .logging import Log
from .utils import getData

logger = Log(__name__).getlog()

special = ["sspai.com"]


def rssParser(
        url: str,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
):
    res = feedparser.parse(url, agent=user_agent)["entries"]
    if "sspai.com" in url:
        for r in res:
            soup = BeautifulSoup(
                getData(r["link"], headers={"User-Agent": user_agent}).text,
                "html.parser",
            )
            r["summary"] = str(
                soup.article.find("div", class_="article-banner") or ""
            ) + str(soup.article.find("div", class_="content wangEditor-txt minHeight"))
            r["summary"] = demoji.replace(r["summary"])

    return res


def rssFullParser(url: str):
    for s in special:
        if s in url:
            return rssParser(url)

    i = 0
    while i < 5:
        try:
            xml_string = morss.process(url)
            break
        except Exception as e:
            logger.error(f"Error parsing: {url} for {i} times, throw {e}, try again")
            i += 1
    else:
        logger.error(f"Error parsing: {url}")
        return rssParser(url)

    return feedparser.parse(xml_string)["entries"]


def objParser(obj: dict, url: str):
    paths = url.split(".")

    for p in paths:
        if p.isdigit():
            p = int(p)

        obj = obj[p]

    return obj
