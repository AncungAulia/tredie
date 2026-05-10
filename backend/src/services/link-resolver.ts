import { log } from "../utils/log";
import * as db from "../db";

export interface LinkMetadata {
  platform: "twitter" | "tiktok" | "youtube" | "instagram" | "unknown";
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  authorName?: string;
  embedHtml?: string;
}

export class LinkResolver {
  async resolve(url: string): Promise<LinkMetadata> {
    const cached = await db.getLinkCache(url);
    if (cached && Number(cached.expires_at) > Date.now()) {
      return cached.metadata as LinkMetadata;
    }

    const platform = this.detectPlatform(url);
    let metadata: LinkMetadata = { platform: "unknown" };

    try {
      switch (platform) {
        case "twitter":
          metadata = await this.resolveTwitter(url);
          break;
        case "tiktok":
          metadata = await this.resolveTikTok(url);
          break;
        case "youtube":
          metadata = await this.resolveYouTube(url);
          break;
        case "instagram":
          metadata = await this.resolveOg(url, "instagram");
          break;
      }
    } catch (e) {
      log.warn({ err: e, url }, "Link resolution failed");
    }

    await db.cacheLinkResolution(url, platform, metadata);
    return metadata;
  }

  private detectPlatform(url: string): LinkMetadata["platform"] {
    if (/twitter\.com|x\.com/i.test(url)) return "twitter";
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    if (/instagram\.com/i.test(url)) return "instagram";
    return "unknown";
  }

  private async resolveTikTok(url: string): Promise<LinkMetadata> {
    const d: any = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    ).then((r) => r.json());
    return {
      platform: "tiktok",
      title: d.title,
      thumbnailUrl: d.thumbnail_url,
      authorName: d.author_name,
      embedHtml: d.html,
    };
  }

  private async resolveYouTube(url: string): Promise<LinkMetadata> {
    const d: any = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    ).then((r) => r.json());
    return {
      platform: "youtube",
      title: d.title,
      thumbnailUrl: d.thumbnail_url,
      authorName: d.author_name,
      embedHtml: d.html,
    };
  }

  private async resolveTwitter(url: string): Promise<LinkMetadata> {
    try {
      const res = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
      );
      if (!res.ok) throw new Error("oembed failed");
      const d: any = await res.json();
      return { platform: "twitter", authorName: d.author_name, embedHtml: d.html };
    } catch {
      return this.resolveOg(url, "twitter");
    }
  }

  private async resolveOg(
    url: string,
    platform: LinkMetadata["platform"],
  ): Promise<LinkMetadata> {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Twitterbot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    return {
      platform,
      title: extractMeta(html, "og:title"),
      description: extractMeta(html, "og:description"),
      thumbnailUrl: extractMeta(html, "og:image"),
    };
  }
}

function extractMeta(html: string, prop: string): string | undefined {
  const m =
    html.match(
      new RegExp(
        `<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
    ) ??
    html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`,
        "i",
      ),
    );
  return m?.[1];
}

export const linkResolver = new LinkResolver();
