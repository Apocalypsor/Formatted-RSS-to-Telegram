import { loadConfigFile } from "@config/config";
import { loadRSSFile } from "@config/rss";

const rss = loadRSSFile(process.env.RSS_PATH);
const config = loadConfigFile(process.env.CONFIG_PATH);

export { rss, config };
