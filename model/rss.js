const logger = require('../lib/logger');
const {expandArrayInObject} = require("../lib/tools");

class RSSItem {
    constructor(input) {
        this.name = input.name || null;
        this.url = input.url || null;
        this.sendTo = input.sendTo || null;

        this.fullText = input.fullText || false;
        this.text = input.text || null;

        this.rules = [];
        if (input.rules) {
            for (const rule of input.rules) {
                const parsedRule = this.parseRule(rule);
                if (parsedRule) {
                    this.rules.push(parsedRule);
                }
            }
        }

        this.filters = [];
        if (input.filters) {
            for (const filter of input.filters) {
                const parsedFilter = this.parseFilter(filter);
                if (parsedFilter) {
                    this.filters.push(parsedFilter);
                }
            }
        }
    }

    parseRule(input) {
        const rule = {
            obj: null,
            type: null,
            matcher: null,
            dest: null,
        }

        const mustHave = ['obj', 'type', 'matcher', 'dest'];
        for (const mustHaveKey of mustHave) {
            if (
                !(mustHaveKey in input)
                || (mustHaveKey === 'type' && !['regex', 'func'].includes(input[mustHaveKey]))
            ) {
                logger.warn(`Invalid rule ${input.obj} to ${input.dest} for ${this.name}, skipping!`);
                return;
            }
        }

        for (const ruleKey in rule) {
            if (ruleKey in input) {
                rule[ruleKey] = input[ruleKey];
            }
        }

        return rule;
    }

    parseFilter(input) {
        const filter = {
            obj: null,
            type: null,
            matcher: null,
        }

        const mustHave = ['obj', 'type', 'matcher'];
        for (const mustHaveKey of mustHave) {
            if (
                !(mustHaveKey in input)
                || (mustHaveKey === 'type' && !['out', 'in'].includes(input[mustHaveKey]))
            ) {
                logger.warn(`Invalid filter ${input.obj} for ${this.name}, skipping!`);
                return;
            }
        }

        for (const filterKey in filter) {
            if (filterKey in input) {
                filter[filterKey] = input[filterKey];
            }
        }

        return filter;
    }
}

class RSS {
    constructor(input) {
        this.rss = [];
        for (const rss of input.rss) {
            if (rss.url && rss.name && rss.sendTo && rss.text) {
                let tmp1 = [];
                if (Array.isArray(rss.url)) {
                    tmp1 = expandArrayInObject(rss, 'url');
                } else {
                    tmp1.push(rss);
                }

                let tmp2 = [];
                if (Array.isArray(rss.sendTo)) {
                    for (const item of tmp1) {
                        tmp2 = tmp2.concat(expandArrayInObject(item, 'sendTo'));
                    }
                } else {
                    tmp2 = tmp1;
                }

                for (const item of tmp2) {
                    this.rss.push(new RSSItem(item));
                }
            } else {
                logger.warn(`Invalid rss ${rss.name}, skipping!`);
            }
        }
    }
}

module.exports = {RSSItem, RSS};