const logger = require('../lib/logger');

class RSS {
    constructor(input) {
        this.name = input.name || null;
        this.url = input.url || null;
        if (typeof this.url === 'string') {
            this.url = [this.url];
        }

        this.sendTo = input.sendTo || null;
        if (typeof this.sendTo === 'string') {
            this.sendTo = [this.sendTo];
        }

        this.telegraph = input.telegraph || false;
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
            if (!(mustHaveKey in input) || !(input[mustHave] === 'type' && input[mustHave] in ['regex', 'func'])) {
                logger.error(`Invalid rule ${input.obj} to ${input.dest} for ${this.name}, skipping!`);
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
            if (!(mustHaveKey in input) || !(input[mustHave] === 'type' && input[mustHave] in ['out', 'in'])) {
                logger.error(`Invalid filter ${input.obj} for ${this.name}, skipping!`);
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

module.exports = RSS;