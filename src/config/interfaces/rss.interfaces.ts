interface RSS {
    name: string;
    url: string;
    sendTo: string;
    disableNotification: boolean;
    disableWebPagePreview: boolean;
    fullText: boolean;
    embedMedia: boolean;
    embedMediaExclude: string[];
    rules: RSSRule[];
    filters: RSSFilter[];
    text: string;
}

interface RSSRule {
    obj: string;
    type: string;
    matcher: string;
    dest: string;
}

interface RSSFilter {
    obj: string;
    type: string;
    matcher: string;
}

export { RSS, RSSRule, RSSFilter };
