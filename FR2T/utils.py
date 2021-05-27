import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


def postData(url, data, headers=None, retry=5, timeout=10):
    retry_strategy = Retry(total=retry, backoff_factor=0.1)

    adapter = HTTPAdapter(max_retries=retry_strategy)
    http = requests.Session()
    http.mount("https://", adapter)
    http.mount("http://", adapter)

    response = http.post(url, data=data, headers=headers, timeout=timeout)

    return response


def escapeText(mode, text):
    escaped_chara = ()

    if mode.lower() == "markdownv2":
        escaped_chara = (
            "_",
            "*",
            "[",
            "]",
            "(",
            ")",
            "~",
            "`",
            ">",
            "#",
            "+",
            "-",
            "=",
            "|",
            "{",
            "}",
            ".",
            "!",
        )

    elif mode.lower() == "markdown":
        escaped_chara = ("_", "*", "`", "[")

    for e in escaped_chara:
        text = text.replace(e, "\\" + e)

    return text


def escapeAll(mode, obj):
    if isinstance(obj, str):
        escaped = escapeText(mode, obj)
        return escaped

    elif isinstance(obj, list):
        for o in range(len(obj)):
            obj[o] = escapeAll(mode, obj[o])
        return obj

    elif isinstance(obj, dict):
        for k, v in obj.items():
            obj[k] = escapeAll(mode, v)
        return obj
