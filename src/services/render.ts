import nunjucks from "nunjucks";

nunjucks.configure({ autoescape: false });

const render = (
    template: string,
    data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    parseMode = "markdown",
): string => {
    return nunjucks
        .renderString(
            escapeTemplate(template, parseMode),
            escapeAll(data, parseMode),
        )
        .replaceAll("&amp;", "&");
};

const escapeTemplate = (template: string, parseMode = "markdown"): string => {
    if (parseMode.toLowerCase() === "markdownv2") {
        const escapedCh = [">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
        const regex = new RegExp(/{{.+?}}|{%.+?%}/g);
        const templateOut = template.split(regex);
        const templateIn = template.match(regex);

        templateOut.forEach((part, i) => {
            if (part !== undefined) {
                escapedCh.forEach((ch) => {
                    if (ch !== undefined) {
                        templateOut[i] = part.replaceAll(ch, "\\" + ch);
                    }
                });
            }
        });

        const finalTemplate: string[] = [];
        templateOut.forEach((part, i) => {
            finalTemplate.push(part);
            if (
                templateIn &&
                templateIn.length > i &&
                templateIn[i] !== undefined
            ) {
                finalTemplate.push(templateIn[i]);
            }
        });

        return finalTemplate.join("");
    } else {
        return template;
    }
};

const escapeText = (text: string, parseMode = "markdown"): string => {
    let escapedCh: string[] = [];
    if (parseMode.toLowerCase() === "markdownv2") {
        escapedCh = [
            "_",
            "*",
            "[",
            "]",
            "(",
            ")",
            "~",
            "`",
            ">",
            "#",
            "+",
            "-",
            "=",
            "|",
            "{",
            "}",
            ".",
            "!",
        ];
    } else if (parseMode.toLowerCase() === "markdown") {
        escapedCh = ["_", "*", "`", "["];
    }

    escapedCh.forEach((e) => {
        text = text.replaceAll(e, "\\" + e);
    });

    return text;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const escapeAll = (obj: any, parseMode = "markdown"): any => {
    if (typeof obj === "string") {
        return escapeText(obj, parseMode);
    } else if (Array.isArray(obj)) {
        return obj.map((o) => escapeAll(o, parseMode));
    } else if (typeof obj === "object") {
        for (const key in obj) {
            obj[key] = escapeAll(obj[key], parseMode);
        }
        return obj;
    }

    return obj;
};

export { render, escapeAll, escapeTemplate, escapeText };
