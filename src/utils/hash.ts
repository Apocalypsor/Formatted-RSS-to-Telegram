import { createHash } from "node:crypto";

export const hash = (string: string): string => {
  return createHash("sha256").update(string).digest("hex");
};
