const fs = require('fs');
const {parse} = require('yaml');
const Config = require('../model/config');
const RSS = require("../model/rss");

require('dotenv').config();

const config = checkConfig(process.env.CONFIG_FILE);
const rss = checkRSS(process.env.RSS_FILE);


function checkConfig(configFile) {
    const configPath = __dirname + '/../config/' + (configFile || 'config.yaml');
    if (!fs.existsSync(configPath)) {
        throw new Error('Config file not found');
    } else {
        const parsed = parse(fs.readFileSync(configPath, 'utf8'));
        return new Config(parsed);
    }
}

function checkRSS(rssFile) {
    const rssPath = __dirname + '/../config/' + (rssFile || 'rss.yaml');
    if (!fs.existsSync(rssPath)) {
        throw new Error('RSS file not found');
    } else {
        const parsed = parse(fs.readFileSync(rssPath, 'utf8'));
        return new RSS(parsed);
    }
}

module.exports = {
    config,
    rss,
    checkConfig,
    checkRSS
}

