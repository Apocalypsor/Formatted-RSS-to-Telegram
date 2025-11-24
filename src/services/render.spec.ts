import { escapeAll, escapeTemplate, escapeText, render } from "./render";

describe("Renderer Module", () => {
    describe("escapeText", () => {
        test("should escape markdown special characters", () => {
            const text = "_Hello_ *World* `Code` [Link](url)";
            const expected = "\\_Hello\\_ \\*World\\* \\`Code\\` \\[Link](url)";
            expect(escapeText(text, "markdown")).toEqual(expected);
        });

        test("should escape markdownv2 special characters", () => {
            const text =
                "_Hello_ *World* `Code` [Link](url) > # + - = | { } . !";
            const expected =
                "\\_Hello\\_ \\*World\\* \\`Code\\` \\[Link\\]\\(url\\) \\> \\# \\+ \\- \\= \\| \\{ \\} \\. \\!";
            expect(escapeText(text, "markdownv2")).toEqual(expected);
        });

        test("should not escape when parseMode is unknown", () => {
            const text = "_Hello_ *World*";
            expect(escapeText(text, "html")).toEqual("_Hello_ *World*");
        });

        test("should escape markdown special characters when parseMode is undefined", () => {
            const text = "_Hello_ *World*";
            const expected = "\\_Hello\\_ \\*World\\*";
            expect(escapeText(text)).toEqual(expected);
        });
    });

    describe("escapeTemplate", () => {
        test("should escape markdownv2 special characters in template", () => {
            const template = "Hello #>World# +{{name}}!";
            const expected = "Hello \\#\\>World\\# \\+{{name}}\\!";
            expect(escapeTemplate(template, "markdownv2")).toEqual(expected);
        });

        test("should not escape template when parseMode is markdown", () => {
            const template = "Hello #World# {{name}}!";
            expect(escapeTemplate(template, "markdown")).toEqual(template);
        });

        test("should not escape template when parseMode is undefined", () => {
            const template = "Hello #World# {{name}}!";
            expect(escapeTemplate(template)).toEqual(template);
        });

        test("should not escape template when parseMode is unknown", () => {
            const template = "Hello #World# {{name}}!";
            expect(escapeTemplate(template)).toEqual(template);
        });
    });

    describe("escapeAll", () => {
        test("should recursively escape strings in  an object", () => {
            const data = {
                title: "Hello *World*",
                content: "This is _markdown_.",
                tags: ["tag1", "*tag2*"],
            };
            const expected = {
                title: "Hello \\*World\\*",
                content: "This is \\_markdown\\_.",
                tags: ["tag1", "\\*tag2\\*"],
            };
            expect(escapeAll(data, "markdown")).toEqual(expected);
        });

        test("should handle arrays and nested objects", () => {
            const data = {
                items: [{ name: "_Item1_" }, { name: "*Item2*" }],
            };
            const expected = {
                items: [{ name: "\\_Item1\\_" }, { name: "\\*Item2\\*" }],
            };
            expect(escapeAll(data)).toEqual(expected);
        });

        test("should handle empty data", () => {
            expect(escapeAll({})).toEqual({});
        });

        test("should handle undefined data fields gracefully", () => {
            const data = { name: undefined };
            expect(escapeAll(data)).toEqual({ name: undefined });
        });

        test("should handle undefined data", () => {
            const data = undefined;
            expect(escapeAll(data)).toEqual(undefined);
        });
    });

    describe("render", () => {
        test("should render template with escaped data in markdown", () => {
            const template = "Hello {{name}}!";
            const data = { name: "_World_" };
            const expected = "Hello \\_World\\_!";
            expect(render(template, data, "markdown")).toEqual(expected);
        });

        test("should render template with escaped data in markdownv2", () => {
            const template = "Hello {{name}}!";
            const data = { name: "_World_" };
            const expected = "Hello \\_World\\_\\!";
            expect(render(template, data, "markdownv2")).toEqual(expected);
        });

        test("should escape template in markdownv2", () => {
            const template = "Hello #{{name}}#.";
            const data = { name: "World" };
            const expected = "Hello \\#World\\#\\.";
            expect(render(template, data, "markdownv2")).toEqual(expected);
        });

        test("should not escape template in markdown", () => {
            const template = "Hello #{{name}}#.";
            const data = { name: "World" };
            const expected = "Hello #World#.";
            expect(render(template, data, "markdown")).toEqual(expected);
        });

        test("should replace &amp; with & in the rendered output", () => {
            const template = "Price: {{price}} &amp; Tax";
            const data = { price: "$10" };
            const expected = "Price: $10 & Tax";
            expect(render(template, data, "markdown")).toEqual(expected);
        });

        test("should handle complex data structures", () => {
            const template =
                "Hello {{user.name}}, you have {{messages.length}} new messages.";
            const data = {
                user: { name: "*User*" },
                messages: [{}, {}, {}],
            };
            const expected = "Hello \\*User\\*, you have 3 new messages.";
            expect(render(template, data, "markdown")).toEqual(expected);
        });

        test("should handle empty template and data", () => {
            expect(render("", {})).toEqual("");
        });

        test("should handle undefined data fields gracefully", () => {
            const template = "Hello {{name}}!";
            const data = {};
            expect(render(template, data)).toEqual("Hello !");
        });

        test("should not escape when parseMode is unknown", () => {
            const template = "Hello {{name}}!";
            const data = { name: "_World_" };
            const expected = "Hello _World_!";
            expect(render(template, data, "html")).toEqual(expected);
        });
    });
});
