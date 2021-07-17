from html_telegraph_poster import TelegraphPoster
from html_telegraph_poster.errors import (
    TelegraphContentTooBigError,
    TelegraphFloodWaitError,
)
from html_telegraph_poster.utils import DocumentPreprocessor


def generateTelegraph(access_token, title, author, content):
    telegraph = TelegraphPoster(access_token=access_token)

    dp = DocumentPreprocessor(content)
    dp.upload_all_images()
    content = dp.get_processed_html()

    try:
        res = telegraph.post(title=title, author=author, text=content)
        return res["url"]
    except TelegraphContentTooBigError:
        print(f"Cannot generate Telegraph for {title}: Content too big.")
        return generateTelegraph(
            access_token,
            title,
            author,
            content="Failed to generate Telegraph: content too big. Please visit the original link.",
        )
    except TelegraphFloodWaitError:
        print(f"Cannot generate Telegraph for {title}: Exceed API limits.")
        return False
    except Exception as e:
        print(f"Cannot generate Telegraph for {title}: Unknown errors {e}.")
        return False
