import logging
import os
import sys
import time


class Log(object):
    def __init__(self, logger=None, log_cate="schedule"):
        self.logger = logging.getLogger(logger)
        self.logger.setLevel(logging.DEBUG)
        self.log_time = time.strftime("%Y_%m_%d")
        file_dir = os.getcwd() + "/logs"
        if not os.path.exists(file_dir):
            os.mkdir(file_dir)
        self.log_path = file_dir
        self.log_name = self.log_path + "/" + log_cate + "." + self.log_time + ".log"

        fh = logging.FileHandler(self.log_name, "a", encoding="utf-8")
        if os.getenv("DEBUG"):
            fh.setLevel(logging.DEBUG)
        else:
            fh.setLevel(logging.INFO)

        ch = logging.StreamHandler(sys.stdout)
        if os.getenv("DEBUG"):
            ch.setLevel(logging.DEBUG)
        else:
            ch.setLevel(logging.INFO)

        formatter = logging.Formatter(
            "[%(asctime)s] %(filename)s->%(funcName)s line:%(lineno)d [%(levelname)s] %(message)s"
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)

        self.logger.addHandler(fh)
        self.logger.addHandler(ch)

        fh.close()
        ch.close()

    def getlog(self):
        return self.logger
