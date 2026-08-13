export type VideoSearchResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
};

export type VideoMeta = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
};

export type TranscriptLine = {
  start: number;
  duration: number;
  text: string;
};

export type DraftArticleSection = {
  startSec: number;
  endSec: number;
  headline: string;
  body: string;
};

export type DraftArticle = {
  title: string;
  dek: string;
  sections: DraftArticleSection[];
};

export type ArticleSection = DraftArticleSection & {
  evidence: string;
};

export type VideoArticle = {
  video: VideoMeta;
  title: string;
  dek: string;
  sections: ArticleSection[];
};

export type AnalyzeStage =
  | "video"
  | "transcript"
  | "structure"
  | "grounding"
  | "complete";

export type AnalyzeEvent =
  | { type: "stage"; stage: AnalyzeStage; message: string }
  | { type: "video"; video: VideoMeta }
  | { type: "result"; article: VideoArticle }
  | { type: "error"; message: string };
