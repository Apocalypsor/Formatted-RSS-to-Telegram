const swig = require('swig-templates');

function render(template, data, parseMode = 'markdown') {
    template = swig.compile(escapeTemplate(template, parseMode));
    return template(escapeAll(data, parseMode));
}

function escapeTemplate(template, parseMode = 'markdown') {
    if (parseMode.toLowerCase() === 'markdownv2') {
        const escapedCh = [">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
        const templateOut = template.split(/{{.+?}}|{%.+?%}/);
        const templateIn = template.match(/{{.+?}}|{%.+?%}/);
        for (let i = 0; i < templateOut.length; i++) {
            for (let j = 0; j < escapedCh.length; j++) {
                templateOut[i] = templateOut[i].replace(escapedCh[j], "\\" + escapedCh[j]);
            }
        }

        const finalTemplate = [];
        for (let i = 0; i < templateOut.length; i++) {
            finalTemplate.push(templateOut[i]);
            if (templateIn[i]) {
                finalTemplate.push(templateIn[i]);
            }
        }
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
        text = text.replace(e, "\\" + e);
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
