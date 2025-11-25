import { ConfigFileNotFoundError, LoadConfigError } from "@errors";
import fs from "fs";
import { parse } from "yaml";
import { type Config, ConfigSchema } from "./schema";
import { DEFAULT_CONFIG_FILE, DEFAULT_DATA_PATH } from "@consts";

export const loadConfigFile = (configFile: string | undefined): Config => {
    const configPath = DEFAULT_DATA_PATH + (configFile || DEFAULT_CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
        throw new ConfigFileNotFoundError(configPath);
    }

    try {
        const parsed = parse(fs.readFileSync(configPath, "utf8"), {
            merge: true,
        });
        return ConfigSchema.parse(parsed);
    } catch (e) {
        console.error(e);
        throw new LoadConfigError(configPath);
    }
};
