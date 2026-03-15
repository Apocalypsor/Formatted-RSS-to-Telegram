import * as _ from "lodash-es";
import nunjucks from "nunjucks";

nunjucks.configure({ autoescape: false });

const HTML_ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
};
const HTML_ENTITY_RE = new RegExp(Object.keys(HTML_ENTITIES).join("|"), "g");

const decodeHtmlEntities = (text: string): string =>
    text.replace(HTML_ENTITY_RE, (match) => HTML_ENTITIES[match] ?? match);

export const render = (
    template: string,
    data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    parseMode = "markdown",
): string => {
    return decodeHtmlEntities(
        nunjucks.renderString(
            escapeTemplate(template, parseMode),
            escapeAll(data, parseMode),
        ),
    );
};

export const escapeTemplate = (
    template: string,
    parseMode = "markdown",
): string => {
    if (parseMode.toLowerCase() === "markdownv2") {
        // Split by template tags, escape the text parts, keep tags unchanged
        const parts = template.split(/({{.+?}}|{%.+?%})/g);
        return parts
            .map((part, i) =>
                // Odd indices are template tags (captured groups), even are text
                i % 2 === 1 ? part : part.replace(/[#+=\-{}.!]/g, "\\$&"),
            )
            .join("");
    } else {
        return template;
    }
};

export const escapeText = (text: string, parseMode = "markdown"): string => {
    if (parseMode.toLowerCase() === "markdownv2") {
        return text.replace(/[\\_*[\]()~`>#+=\-|{}.!]/g, "\\$&");
    } else if (parseMode.toLowerCase() === "markdown") {
        return text.replace(/[_*`[]/g, "\\$&");
    }
    return text;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const escapeAll = (obj: any, parseMode = "markdown"): any => {
    return _.cloneDeepWith(obj, (value) => {
        if (typeof value === "string") {
            return escapeText(value, parseMode);
        }
    });
};
