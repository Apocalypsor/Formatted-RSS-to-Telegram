import os

from FR2T import fr2t
from FR2T.utils import getConfigFile

if __name__ == "__main__":
    config_path = "data/config.yaml"

    if os.getenv("RSS_CONFIG"):
        rss_path = os.getenv("RSS_CONFIG")
        if not rss_path.startswith("http"):
            rss_path = "data/" + rss_path
    else:
        rss_path = "data/rss.yaml"

    fr = fr2t.FR2T(*getConfigFile(config_path, rss_path))
    fr.purge()
