import random

import demoji
from bs4 import BeautifulSoup
from html_telegraph_poster import TelegraphPoster
from html_telegraph_poster.errors import (
    TelegraphFloodWaitError,
    TelegraphPageSaveFailed,
)
from html_telegraph_poster.utils import DocumentPreprocessor

from .logging import Log
from .utils import getData

logger = Log(__name__).getlog()


def generateTelegraph(access_token, title, author, content):
    if not content: return "https://telegra.ph/Cannot-save-page-08-04"
    telegraph = TelegraphPoster(access_token=access_token)

    dp = DocumentPreprocessor(content)
    dp.upload_all_images()
    processed_content = dp.get_processed_html()

    try:
        res = telegraph.post(title=title, author=author, text=processed_content)
        if analyzeTelegraph(res["url"], processed_content):
            return res["url"]
        else:
            logger.warn(
                "Cannot generate Telegraph for {}: Trying to remove emojis for {}.".format(
                    title, res["path"]
                )
            )
            demojied_content = demoji.replace(content)
            dpp = DocumentPreprocessor(demojied_content)
            dpp.upload_all_images()
            processed_demojied_content = dpp.get_processed_html()

            res_no_emojis = telegraph.edit(
                path=res["path"], text=processed_demojied_content
            )
            return res_no_emojis["url"]
    except TelegraphPageSaveFailed as e:
        logger.debug(f"Telegraph debug for {title}: {e}")
        logger.error(f"Cannot generate Telegraph for {title}: Cannot save page.")
        return "https://telegra.ph/Cannot-save-page-08-04"
    except TelegraphFloodWaitError as e:
        logger.debug(f"Telegraph debug for {title}: {e}")
        logger.error(f"Cannot generate Telegraph for {title}: Exceed API limits.")
        return False
    except Exception as e:
        if "CONTENT_TOO_BIG" in str(e):
            logger.debug(f"Telegraph debug for {title}: {e}")
            logger.error(f"Cannot generate Telegraph for {title}: Content too big.")
            return "https://telegra.ph/Content-too-big-08-04"

        logger.error(f"Cannot generate Telegraph for {title}: Unknown errors {e}.")
        return False


def analyzeTelegraph(url, content):
    res = getData(url).text
    res_soup = BeautifulSoup(res, "html.parser")
    res_split = res_soup.get_text("\n").split("\n")

    content_soup = BeautifulSoup(content, "html.parser")
    content_split = [c for c in content_soup.get_text("\n").split("\n") if c]

    if content_split:
        content_keyword = random.choice(content_split)
        if content_keyword not in res_split:
            return False

    return True
