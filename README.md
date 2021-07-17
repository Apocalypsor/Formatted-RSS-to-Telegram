# Formatted RSS to Telegram

基于Github Action的高度可定制化Telegram通知推送服务。

## 配置文件

### 主配置文件

默认读取`data/config.yaml`，也可以用环境变量来定义，环境变量优先级更高。

具体配置如下：

| 配置文件项                        | 环境变量                    | 属性   | 默认值       | 说明                                    |
| --------------------------------- | --------------------------- | ------ | ------------ | --------------------------------------- |
| database_url                      | DATABASE                    | 必须   |              | MongoDB数据库URL                        |
| expire_time                       | EXPIRE_TIME                 | 非必须 | `30d`        | 数据库中的数据过期时间，见**说明1**     |
| user-agent                        | USER-AGENT                  | 非必须 | 浏览器UA     | 请求所用的User-Agent，见**说明2**       |
| telegram.token                    | TG_TOKEN                    | 必须   |              | Telegram Bot的Token                     |
| telegram.chat_id                  | TG_CHAT_ID                  | 必须   |              | 推送通知的Chat ID                       |
| telegram.disable_notification     | TG_DISABLE_NOTIFICATION     | 非必须 | `false`      | 默认推送通知时是否静默                  |
| telegram.disable_web_page_preview | TG_DISABLE_WEB_PAGE_PREVIEW | 非必须 | `false`      | 默认推送通知时是否预览                  |
| telegram.parse_mode               | TG_PARSE_MODE               | 非必须 | `MarkdownV2` | 默认推送通知时的解析文字的格式，见说明3 |
| telegraph_access_token            | TELEGRAPH_ACCESS_TOKEN      | 非必须 |              | 用于生成Telegraph                       |

**说明：**

1. `expire_time`可取值为数字加y/m/d/h，分别代表年、月、日、时。该项表示执行清理时保留直到多久前的数据。
2. `user-agent`
   默认为`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36`
   。
3. `telegram.parse_mode`的详细说明见[Telegram官方说明](https://core.telegram.org/bots/api#formatting-options)。

### RSS订阅配置文件

默认读取`data/rss.yaml`，可以通过定义环境变量`RSS_CONFIG`来定义读取的文件。

例如将其定义为`rss2.yaml`，则会读取`data/rss2.yaml`文件。

也可以将其定义为一个链接（必须以http开头），例如 https://raw.githubusercontent.com/Apocalypsor/Formatted-RSS-to-Telegram/main/data/rss_example.yaml 。

如果链接需要 `Bearer Authentication`（例如Github），可以定义环境变量`AUTHORIZATION_TOKEN`来验证。

配置文件仅读取`rss`项，其包含一个数组。以下介绍该数组中的每一个成员：

* `name`：订阅名称，是一个字符串。
* `url`：订阅链接，可以是一个字符串，也可以是一个数组。

```yaml
url: https://sspai.com/feed

# 或着

url:
  - https://rss.dov.moe/youtube/channel/UCMUnInmOkrWN4gof9KlhNmQ
  - https://rss.dov.moe/youtube/channel/UC2tQpW0dPiyWPebwBSksJ_g
```

* `rules`：处理规则，可以对文本进行一定的处理，是一个数组。数组中每个成员包含以下项：
  * `obj`：处理的对象，以`.`相隔代表子项，例如`a.0.c`代表`["a"][0]["c"]`。
  * `type`：可以是`regex`或`func`。
  * `dest`：处理完成的文本储存的变量。
  * `matcher`：（假设`dest`为`dest_text`）
    * 如果`type`为`regex`，则为一个正则表达式的字符串，用`()`来提取需要的文本。如果只匹配一项，则可在`text`中用`{{ dest_text }}`来引用；如果匹配多项，则可在`text`中用`{{ dest_text[数字] }}`来引用，**注意默认`{{ dest_text[0] }}`为匹配到的整个字符串**。
    * 如果`type`为`func`，则为一个简单python函数的多行字符串，输入和输出仅能为1个变量，分别代表`obj`和`dest`，会将输入的变量进行处理后赋值到输出变量中。

* `filters`：过滤规则，可以过滤掉指定通知，是一个数组。数组中每个成员包含以下项：
  * `obj`：处理的对象，同上。
  * `matcher`：匹配的正则表达式字符串。
  * `type`：可为`in`或`out`。如果为`in`，则匹配到的项可以被推送；如果为`out`，则未匹配到的项可以被推送。
* `fulltext`：`true`或者`false`，是否对rss获取全文。
* `telegraph`：`true`或者`false`，是否针对内容生成Telegrah文章。**注意默认会读取RSS中的`["content"][0]["value"]`，如果没有则会报错！**生成的Telegraph链接可以在`text`中用`{{ telegraph}}`来引用。
* `content`：为了避免RSS中没有所需的内容，以及一些特别的需求，用于处理文本以生成Telegraph文章，便于即使预览。应包含：
  * `obj`：处理的对象，同上。
  * `matcher`：为一个简单python函数的多行字符串，输入和输出仅能为1个变量，输入代表`obj`，输出处理完的文本。

* `text`：推送通知的模板，可以用`jinja2`语法。**特别注意，此中可引用的变量包括RSS中的内容、`rules`中处理的文本的`dest`、`rss_name`（表示上述`name`的值）、`rss_url`（表示对应RSS的URL）、`rss_content`（上述`content`中的输出文本，若无`content`，则为RSS中的`["content"][0]["value"]`）**。

## 使用方法

首先安装好`python`和`pip`。

其次安装依赖：

```bash
pip install pipenv

# 进入仓库的目录下

pipenv install
```

然后按照格式编写配置文件，如果要查看RSS链接的内容，可以用以下命令

```bash
pipenv run python test/rss.py rss链接
```

会生成对应的`json`文件，以此为参考来写配置文件。

最后执行：

```bash
# 推送通知
pipenv run python main.py

# 清理数据库
pipenv run python clean.py
```

