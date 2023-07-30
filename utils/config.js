const fs = require("fs");
const { parse } = require("yaml");
const Config = require("@models/config");
const { RSS } = require("@models/rss");

const checkConfig = (configFile) => {
    const configPath =
        __dirname + "/../config/" + (configFile || "config.yaml");
    if (!fs.existsSync(configPath)) {
        throw new Error("Config file not found");
    } else {
        const parsed = parse(fs.readFileSync(configPath, "utf8"), {
            merge: true,
        });
        return new Config(parsed);
    }
};

const checkRSS = (rssFile) => {
    const rssPath = __dirname + "/../config/" + (rssFile || "rss.yaml");
    if (!fs.existsSync(rssPath)) {
        throw new Error("RSS file not found");
    } else {
        const parsed = parse(fs.readFileSync(rssPath, "utf8"), { merge: true });
        return new RSS(parsed);
    }
};

const config = checkConfig(process.env.CONFIG_FILE);
const rss = checkRSS(process.env.RSS_FILE);

module.exports = {
    config,
    rss,
};
