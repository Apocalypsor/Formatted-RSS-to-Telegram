import { ConfigFileNotFoundError, LoadConfigError } from "@errors/config";
import fs from "fs";
import { parse } from "yaml";
import { type Config, ConfigSchema } from "@config/types";
import { ZodError } from "zod";

const parseConfig = (data: unknown): Config => {
    try {
        return ConfigSchema.parse(data);
    } catch (error) {
        if (error instanceof ZodError) {
            console.error("Config validation errors:", error.errors);
        }
        throw error;
    }
};

export const loadConfigFile = (configFile: string | undefined): Config => {
    const configPath = "./config/" + (configFile || "config.yaml");
    if (!fs.existsSync(configPath)) {
        throw new ConfigFileNotFoundError(configPath);
    }

    try {
        const parsed = parse(fs.readFileSync(configPath, "utf8"), {
            merge: true,
        });
        return parseConfig(parsed);
    } catch (e) {
        console.error(e);
        throw new LoadConfigError(configPath);
    }
};
