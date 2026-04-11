import dns from "node:dns";
import { getClient } from "./client";

export const parseIPFromURL = async (url: string | URL): Promise<string> => {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    dns.lookup(parsed.hostname, (err, address) => {
      if (err) {
        reject(err);
      } else {
        resolve(address);
      }
    });
  });
};

export const isIntranet = (ip: string): boolean => {
  // IPv6 loopback and private ranges
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  // IPv4 loopback
  if (parts[0] === "127") return true;
  // 10.0.0.0/8
  if (parts[0] === "10") return true;
  // 172.16.0.0/12
  if (
    parts[0] === "172" &&
    parts[1] &&
    parseInt(parts[1], 10) >= 16 &&
    parseInt(parts[1], 10) <= 31
  ) {
    return true;
  }
  // 192.168.0.0/16
  return parts[0] === "192" && parts[1] === "168";
};

export const getHostIPInfo = async (): Promise<string | null> => {
  const client = await getClient(true);
  try {
    const resp = await client
      .get("https://api.dov.moe/ip")
      .json<{ data?: unknown }>();
    if (resp?.data) return JSON.stringify(resp.data);
  } catch {
    // fall through to fallback
  }
  try {
    return await client.get("https://1.1.1.1/cdn-cgi/trace").text();
  } catch {
    return null;
  }
};
