import type { VideoSearchResult } from "@/lib/types";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

export function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "live", "embed"].includes(parts[0]) && parts[1]) {
        return /^[A-Za-z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY가 설정되지 않았습니다.");
  return key;
}

export async function searchYouTube(query: string): Promise<VideoSearchResult[]> {
  const searchParams = new URLSearchParams({
    part: "snippet",
    q: query,
    maxResults: "6",
    type: "video",
    videoCaption: "closedCaption",
    relevanceLanguage: "ko",
    regionCode: "KR",
    safeSearch: "moderate",
    key: apiKey(),
  });

  const searchResponse = await fetch(`${API_ROOT}/search?${searchParams}`, {
    cache: "no-store",
  });
  if (!searchResponse.ok) throw new Error("YouTube 검색에 실패했습니다.");

  const searchJson = await searchResponse.json();
  const items = Array.isArray(searchJson.items) ? searchJson.items : [];
  const ids = items.map((item: any) => item?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const detailsParams = new URLSearchParams({
    part: "contentDetails",
    id: ids.join(","),
    key: apiKey(),
  });
  const detailsResponse = await fetch(`${API_ROOT}/videos?${detailsParams}`, {
    cache: "no-store",
  });
  if (!detailsResponse.ok) throw new Error("영상 길이를 불러오지 못했습니다.");
  const detailsJson = await detailsResponse.json();
  const durations = new Map<string, string>(
    (detailsJson.items ?? []).map((item: any) => [
      item.id,
      formatIsoDuration(item.contentDetails?.duration ?? ""),
    ]),
  );

  return items.map((item: any) => ({
    id: item.id.videoId,
    title: decodeEntities(item.snippet.title),
    channelTitle: decodeEntities(item.snippet.channelTitle),
    thumbnail:
      item.snippet.thumbnails?.medium?.url ??
      item.snippet.thumbnails?.default?.url ??
      `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
    publishedAt: item.snippet.publishedAt,
    duration: durations.get(item.id.videoId) ?? "",
  }));
}

export async function getVideoMeta(videoId: string) {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: videoId,
    key: apiKey(),
  });
  const response = await fetch(`${API_ROOT}/videos?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("영상 정보를 불러오지 못했습니다.");
  const json = await response.json();
  const item = json.items?.[0];
  if (!item) throw new Error("영상을 찾을 수 없습니다.");

  return {
    id: videoId,
    title: decodeEntities(item.snippet.title),
    channelTitle: decodeEntities(item.snippet.channelTitle),
    thumbnail:
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: formatIsoDuration(item.contentDetails?.duration ?? ""),
  };
}

function formatIsoDuration(value: string) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
