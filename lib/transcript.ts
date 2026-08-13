import {
  NoTranscriptFound,
  RequestBlocked,
  TranscriptsDisabled,
  YouTubeTranscriptApi,
} from "@hallelx/youtube-transcript";
import type { TranscriptLine } from "@/lib/types";

export async function fetchTranscript(videoId: string): Promise<TranscriptLine[]> {
  const api = new YouTubeTranscriptApi();

  try {
    const list = await api.list(videoId);
    let selected;

    try {
      selected = list.findTranscript(["ko", "en"]);
    } catch (error) {
      if (!(error instanceof NoTranscriptFound)) throw error;
      selected = Array.from(list)[0];
    }

    if (!selected) {
      throw new Error("이 영상에서 사용할 수 있는 공개 자막을 찾지 못했습니다.");
    }

    const transcript = await selected.fetch();
    return Array.from(transcript)
      .map((snippet) => ({
        start: Number(snippet.start),
        duration: Number(snippet.duration),
        text: cleanText(snippet.text),
      }))
      .filter((line) => Number.isFinite(line.start) && Number.isFinite(line.duration) && line.text);
  } catch (error) {
    if (error instanceof RequestBlocked) {
      throw new Error(
        "YouTube가 서버 IP의 자막 요청을 막았습니다. 로컬에서는 동작할 수 있지만 Vercel 배포에서는 별도 자막 공급자가 필요할 수 있습니다.",
      );
    }
    if (error instanceof TranscriptsDisabled || error instanceof NoTranscriptFound) {
      throw new Error("이 영상에서 사용할 수 있는 공개 자막을 찾지 못했습니다.");
    }
    throw error;
  }
}

export function compactTranscript(lines: TranscriptLine[]) {
  const blocks: { start: number; end: number; text: string }[] = [];
  let current: { start: number; end: number; text: string } | null = null;

  for (const line of lines) {
    if (!line.text) continue;
    const end = line.start + line.duration;

    if (!current || end - current.start > 28 || current.text.length > 700) {
      if (current) blocks.push(current);
      current = { start: line.start, end, text: line.text };
    } else {
      current.end = end;
      current.text += ` ${line.text}`;
    }
  }
  if (current) blocks.push(current);

  return blocks;
}

export function evidenceForSection(lines: TranscriptLine[], startSec: number, endSec: number) {
  const relevant = lines.filter(
    (line) => line.start >= Math.max(0, startSec - 2) && line.start <= endSec + 2,
  );
  if (!relevant.length) return "";

  const middle = Math.floor(relevant.length / 2);
  const sampled = relevant.length <= 7
    ? relevant
    : [
        ...relevant.slice(0, 2),
        relevant[middle],
        ...relevant.slice(-2),
      ];

  const seen = new Set<string>();
  const text = sampled
    .filter((line) => {
      const key = `${line.start}:${line.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line) => line.text)
    .join(" … ")
    .trim();

  return text.length > 520 ? `${text.slice(0, 517)}…` : text;
}

function cleanText(value: string) {
  return value
    .replace(/\[(?:음악|박수|웃음|music|applause|laughter)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
