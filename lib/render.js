const nunjucks = require('nunjucks');
nunjucks.configure({autoescape: false});

function render(template, data, parseMode = 'markdown') {
    return nunjucks.renderString(
        escapeTemplate(template, parseMode),
        escapeAll(data, parseMode)
    ).replaceAll('&amp;', '&');
}

function escapeTemplate(template, parseMode = 'markdown') {
    if (parseMode.toLowerCase() === 'markdownv2') {
        const escapedCh = [">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
        const regex = new RegExp(/{{.+?}}|{%.+?%}/g);
        const templateOut = template.split(regex);
        const templateIn = template.match(regex);

        for (let i = 0; i < templateOut.length; i++) {
            for (let j = 0; j < escapedCh.length; j++) {
                templateOut[i] = templateOut[i].replaceAll(escapedCh[j], "\\" + escapedCh[j]);
            }
        }

        const finalTemplate = [];
        for (let i = 0; i < templateOut.length; i++) {
            finalTemplate.push(templateOut[i]);
            if (templateIn[i]) {
                finalTemplate.push(templateIn[i]);
            }
        }

        console.log(finalTemplate.join(''));
        return finalTemplate.join('');
    } else {
        return template;
    }
}

function escapeText(text, parseMode = 'markdown') {
    let escapedCh = [];
    if (parseMode.toLowerCase() === 'markdownv2') {
        escapedCh = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
    } else if (parseMode.toLowerCase() === 'markdown') {
        escapedCh = ["_", "*", "`", "["];
    }

    for (let e of escapedCh) {
        text = text.replaceAll(e, "\\" + e);
    }


    return text;
}

function escapeAll(obj, parseMode = 'markdown') {
    if (typeof obj === 'string') {
        return escapeText(obj, parseMode);
    } else if (Array.isArray(obj)) {
        return obj.map(o => escapeAll(o, parseMode));
    } else if (typeof obj === 'object') {
        for (let key in obj) {
            obj[key] = escapeAll(obj[key], parseMode);
        }
        return obj;
    }

    return obj;
}

module.exports = {
    escapeTemplate,
    render
}
