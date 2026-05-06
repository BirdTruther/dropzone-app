import ogs from 'open-graph-scraper';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  try {
    const { result } = await ogs({ url, timeout: 5000 });
    return {
      url,
      title: result.ogTitle ?? result.twitterTitle ?? undefined,
      description: result.ogDescription ?? result.twitterDescription ?? undefined,
      image: result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url ?? undefined,
      siteName: result.ogSiteName ?? new URL(url).hostname,
    };
  } catch {
    return {
      url,
      siteName: (() => { try { return new URL(url).hostname; } catch { return url; } })(),
    };
  }
}
