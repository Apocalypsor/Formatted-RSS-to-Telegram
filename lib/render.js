const template = require('swig');
const config = require('../lib/config').config;

function escapeTemplate(template, parseMode = 'markdown') {
    if (parseMode.toLowerCase() === 'markdownv2') {
        const escaped_ch = [">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
        const templateOut = escaped_ch.split(/{{.+?}}|{%.+?%}/);
        const templateIn = escaped_ch.match(/{{.+?}}|{%.+?%}/);
        for (let i = 0; i < templateOut.length; i++) {
            for (let j = 0; j < escaped_ch.length; j++) {
                templateOut[i] = templateOut[i].replace(escaped_ch[j], "\\" + escaped_ch[j]);
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
