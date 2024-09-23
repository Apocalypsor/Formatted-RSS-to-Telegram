import nunjucks from "nunjucks";

nunjucks.configure({ autoescape: false });

const render = (
    template: string,
    data: any,
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

        for (let i = 0; i < templateOut.length; i++) {
            for (let j = 0; j < escapedCh.length; j++) {
                templateOut[i] = templateOut[i].replaceAll(
                    escapedCh[j],
                    "\\" + escapedCh[j],
                );
            }
        }

        const finalTemplate = [];
        for (let i = 0; i < templateOut.length; i++) {
            finalTemplate.push(templateOut[i]);
            if (templateIn && templateIn.length > i) {
                finalTemplate.push(templateIn[i]);
            }
        }

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

    for (let e of escapedCh) {
        text = text.replaceAll(e, "\\" + e);
    }

    return text;
};

const escapeAll = (obj: any, parseMode = "markdown"): any => {
    if (typeof obj === "string") {
        return escapeText(obj, parseMode);
    } else if (Array.isArray(obj)) {
        return obj.map((o) => escapeAll(o, parseMode));
    } else if (typeof obj === "object") {
        for (let key in obj) {
            obj[key] = escapeAll(obj[key], parseMode);
        }
        return obj;
    }

    return obj;
};

export { render };
