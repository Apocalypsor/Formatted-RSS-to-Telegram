import { loadConfigFile } from "./config";
import { loadRSSFile } from "./rss";

const rss = loadRSSFile(process.env.RSS_PATH);
const config = loadConfigFile(process.env.CONFIG_PATH);

export { rss, config };
export * from "./schema";
