const logger = require("@utils/logger");
const { expandArrayInObject } = require("@utils/tools");

class RSSItem {
    constructor(input) {
        this.name = input.name || null;
        this.url = input.url || null;
        this.sendTo = input.sendTo || null;
        this.disableNotification = input.disableNotification || false;
        this.disableWebPagePreview = input.disableWebPagePreview || false;

        this.fullText = input.fullText || false;
        this.text = input.text || null;

        this._rules = [];
        this.rules = input.rules;

        this._filters = [];
        this.filters = input.filters;
    }

    set rules(rulesInput) {
        if (rulesInput) {
            rulesInputLoop: for (const rule of rulesInput) {
                const mustHave = ["obj", "type", "matcher", "dest"];
                for (const mustHaveKey of mustHave) {
                    if (
                        !rule.hasOwnProperty(mustHaveKey) ||
                        (mustHaveKey === "type" &&
                            !["regex", "func"].includes(rule[mustHaveKey]))
                    ) {
                        logger.warn(
                            `Invalid rule ${rule.obj} to ${rule.dest} for ${this.name}, skipping!`
                        );
                        continue rulesInputLoop;
                    }
                }

                const parsedRule = {
                    obj: null,
                    type: null,
                    matcher: null,
                    dest: null,
                };

                for (const ruleKey in parsedRule) {
                    if (rule.hasOwnProperty(ruleKey)) {
                        parsedRule[ruleKey] = rule[ruleKey];
                    }
                }

                this._rules.push(parsedRule);
            }
        }
    }

    get rules() {
        return this._rules;
    }

    set filters(filtersInput) {
        if (filtersInput) {
            filtersInputLoop: for (const filter of filtersInput) {
                const mustHave = ["obj", "type", "matcher"];
                for (const mustHaveKey of mustHave) {
                    if (
                        !filter.hasOwnProperty(mustHaveKey) ||
                        (mustHaveKey === "type" &&
                            !["out", "in"].includes(filter[mustHaveKey]))
                    ) {
                        logger.warn(
                            `Invalid filter ${filter.obj} for ${this.name}, skipping!`
                        );
                        continue filtersInputLoop;
                    }
                }

                const parsedFilter = {
                    obj: null,
                    type: null,
                    matcher: null,
                };

                for (const filterKey in parsedFilter) {
                    if (filter.hasOwnProperty(filterKey)) {
                        parsedFilter[filterKey] = filter[filterKey];
                    }
                }

                this._filters.push(parsedFilter);
            }
        }
    }

    get filters() {
        return this._filters;
    }
}

class RSS {
    constructor(input) {
        this.rss = [];
        for (const rss of input.rss) {
            if (rss.url && rss.name && rss.sendTo && rss.text) {
                let tmp1 = [];
                if (Array.isArray(rss.url)) {
                    tmp1 = expandArrayInObject(rss, "url");
                } else {
                    tmp1.push(rss);
                }

                let tmp2 = [];
                if (Array.isArray(rss.sendTo)) {
                    for (const item of tmp1) {
                        tmp2 = tmp2.concat(expandArrayInObject(item, "sendTo"));
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

module.exports = { RSSItem, RSS };
