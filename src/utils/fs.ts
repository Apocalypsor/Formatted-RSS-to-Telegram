import fs from "node:fs";

export const createDirIfNotExists = async (dir: fs.PathLike) => {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};
