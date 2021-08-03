import copyreg
import os
import ssl

import requests
import yaml
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

default_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"


def postData(url, data, headers=None, retry=5, timeout=10):
    retry_strategy = Retry(total=retry, backoff_factor=0.1)

    adapter = HTTPAdapter(max_retries=retry_strategy)
    http = requests.Session()
    http.mount("https://", adapter)
    http.mount("http://", adapter)

    response = http.post(url, data=data, headers=headers, timeout=timeout)

    return response


def getData(url, headers=None, retry=5, timeout=10):
    retry_strategy = Retry(total=retry, backoff_factor=0.1)

    adapter = HTTPAdapter(max_retries=retry_strategy)
    http = requests.Session()
    http.mount("https://", adapter)
    http.mount("http://", adapter)

    response = http.get(url, headers=headers, timeout=timeout)

    return response


def execFunc(obj, func):
    tmp_obj = obj
    loc = locals()
    tmp_func = func + "\ntmp_return = func(tmp_obj)\n"
    exec(tmp_func)
    return loc["tmp_return"]


def pickleSSL():
    def saveSSLContext(obj):
        return obj.__class__, (obj.protocol,)

    copyreg.pickle(ssl.SSLContext, saveSSLContext)


def getConfigFile(config_path, rss_path):
    with open(config_path, "r", encoding="UTF-8") as c:
        config = yaml.safe_load(c)

    if rss_path.startswith("http"):
        print("使用RSS配置：{}".format(rss_path.split("/")[-1]))
        headers = {"User-Agent": default_user_agent}
        if os.getenv("AUTHORIZATION_TOKEN"):
            headers["Authorization"] = "token {}".format(
                os.getenv("AUTHORIZATION_TOKEN")
            )

        res = getData(rss_path, headers=headers).text
        rss = yaml.safe_load(res)
    else:
        print("使用RSS配置：{}".format(rss_path))
        with open(rss_path, "r", encoding="UTF-8") as c:
            rss = yaml.safe_load(c)

    return config, rss


def dictDeleteNone(_dict):
    for key, value in list(_dict.items()):
        if isinstance(value, dict):
            dictDeleteNone(value)
        elif value is None:
            del _dict[key]
        elif isinstance(value, list):
            for v_i in value:
                dictDeleteNone(v_i)

    return _dict
