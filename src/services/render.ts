import nunjucks from "nunjucks";

nunjucks.configure({ autoescape: false });

export const render = (
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

export const escapeTemplate = (
    template: string,
    parseMode = "markdown",
): string => {
    if (parseMode.toLowerCase() === "markdownv2") {
        const escapedCh = [">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];

        const escapeChars = (text: string): string => {
            let escaped = text;
            for (const ch of escapedCh) {
                escaped = escaped.replaceAll(ch, "\\" + ch);
            }
            return escaped;
        };

        // Split by template tags, escape the text parts, keep tags unchanged
        const parts = template.split(/({{.+?}}|{%.+?%})/g);
        return parts
            .map((part, i) =>
                // Odd indices are template tags (captured groups), even are text
                i % 2 === 1 ? part : escapeChars(part),
            )
            .join("");
    } else {
        return template;
    }
};

export const escapeText = (text: string, parseMode = "markdown"): string => {
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
export const escapeAll = (obj: any, parseMode = "markdown"): any => {
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
