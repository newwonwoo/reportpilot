"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzeEvent, AnalyzeStage, VideoArticle, VideoMeta, VideoSearchResult } from "@/lib/types";

const STAGES: Array<{ id: AnalyzeStage; label: string }> = [
  { id: "video", label: "영상 확인" },
  { id: "transcript", label: "자막 불러오기" },
  { id: "structure", label: "글 구조 분석" },
  { id: "grounding", label: "원문 연결" },
  { id: "complete", label: "완료" },
];

export function Analyzer() {
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [stage, setStage] = useState<AnalyzeStage | null>(null);
  const [stageMessage, setStageMessage] = useState("");
  const [article, setArticle] = useState<VideoArticle | null>(null);
  const [error, setError] = useState("");

  const direct = useMemo(() => {
    const value = input.trim();
    return /youtu(?:\.be|be\.com)/i.test(value) || /^[A-Za-z0-9_-]{11}$/.test(value);
  }, [input]);
  const busy = searching || (!!stage && stage !== "complete" && !article);

  function resetOutput() {
    setResults([]);
    setSearched(false);
    setVideo(null);
    setArticle(null);
    setError("");
  }

  async function submit() {
    const value = input.trim();
    if (!value || busy) return;
    resetOutput();
    if (direct) return analyze(value);

    setSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "검색에 실패했습니다.");
      setResults(json.results ?? []);
      setSearched(true);
    } catch (e) {
      setError(errorMessage(e, "검색에 실패했습니다."));
    } finally {
      setSearching(false);
    }
  }

  async function analyze(videoId: string) {
    resetOutput();
    setStage("video");
    setStageMessage("영상 정보를 확인하고 있어요.");

    const apply = (event: AnalyzeEvent) => {
      if (event.type === "stage") {
        setStage(event.stage);
        setStageMessage(event.message);
      } else if (event.type === "video") {
        setVideo(event.video);
      } else if (event.type === "result") {
        setArticle(event.article);
        setStage("complete");
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    };

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "분석을 시작하지 못했습니다.");
      }
      if (!response.body) throw new Error("분석 응답을 받을 수 없습니다.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) apply(JSON.parse(line) as AnalyzeEvent);
      }
      buffer += decoder.decode();
      if (buffer.trim()) apply(JSON.parse(buffer) as AnalyzeEvent);
    } catch (e) {
      setStage(null);
      setError(errorMessage(e, "분석 중 오류가 발생했습니다."));
    }
  }

  if (article) return <ArticleView article={article} onReset={() => { setArticle(null); setStage(null); setVideo(null); setInput(""); }} />;

  return (
    <main>
      <header className="siteHeader">
        <a className="brand" href="#top"><span className="brandMark">F</span>FrameBrief</a>
        <span className="headerNote">Video → Brief</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">영상을 보지 않아도 흐름은 놓치지 않게</div>
        <h1>긴 영상을,<br />읽을 만한 글로.</h1>
        <p className="heroCopy">YouTube 링크를 붙이거나 주제를 검색하세요. 시간축은 남기고 반복과 군더더기만 덜어냅니다.</p>

        <div className="commandBar">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="YouTube 링크 또는 검색어"
            aria-label="YouTube 링크 또는 검색어"
          />
          <button onClick={submit} disabled={!input.trim() || busy}>{searching ? "찾는 중" : direct ? "글로 만들기" : "찾기"}</button>
        </div>
        <div className="inputHint">URL이면 바로 분석 · 검색어면 자막 있는 영상을 먼저 찾습니다.</div>
        {error && <div className="errorBox">{error}</div>}

        {!!results.length && (
          <section className="searchResults">
            <div className="sectionHeading"><b>검색 결과</b><span>읽고 싶은 영상을 고르세요</span></div>
            <div className="resultGrid">
              {results.map((item) => (
                <button className="videoCard" key={item.id} onClick={() => analyze(item.id)}>
                  <div className="thumbWrap"><img src={item.thumbnail} alt="" />{item.duration && <span>{item.duration}</span>}</div>
                  <div className="videoMeta"><strong>{item.title}</strong><small>{item.channelTitle}</small></div>
                </button>
              ))}
            </div>
          </section>
        )}

        {searched && !results.length && !stage && !error && <div className="emptyState">자막이 있는 검색 결과가 없습니다. 검색어를 조금 넓혀보세요.</div>}
        {stage && <ProgressPanel current={stage} message={stageMessage} video={video} />}
        {!searched && !results.length && !stage && <Principles />}
      </section>
    </main>
  );
}

function Principles() {
  return <div className="principles">
    <div><b>01</b><strong>시간축 보존</strong><p>모든 대목을 원본 영상 위치와 연결합니다.</p></div>
    <div><b>02</b><strong>의미 단위 편집</strong><p>몇 분 간격이 아니라 주제가 바뀌는 지점에서 나눕니다.</p></div>
    <div><b>03</b><strong>원문 우선</strong><p>AI의 배경지식보다 영상 안의 발언을 우선합니다.</p></div>
  </div>;
}

function ProgressPanel({ current, message, video }: { current: AnalyzeStage; message: string; video: VideoMeta | null }) {
  const index = STAGES.findIndex((item) => item.id === current);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [current]);

  return <section className="progressShell" aria-live="polite">
    <div>
      <div className="progressIntro"><i /><div><span>지금 하는 일</span><h2>{message}</h2><p>{delayHint(current, elapsed)}</p></div></div>
      {video && <div className="progressVideo"><img src={video.thumbnail} alt="" /><div><strong>{video.title}</strong><small>{video.channelTitle} · {video.duration}</small></div></div>}
    </div>
    <ol className="timeline">
      {STAGES.map((item, i) => {
        const done = i < index || current === "complete";
        const active = item.id === current && current !== "complete";
        return <li key={item.id} className={`${done ? "done" : ""} ${active ? "active" : ""}`}><span>{done ? "✓" : i + 1}</span>{item.label}</li>;
      })}
    </ol>
  </section>;
}

function ArticleView({ article, onReset }: { article: VideoArticle; onReset: () => void }) {
  return <article className="articlePage">
    <div className="articleTopbar"><button onClick={onReset}>← 새 영상</button><a href={`https://www.youtube.com/watch?v=${article.video.id}`} target="_blank" rel="noreferrer">YouTube에서 보기 ↗</a></div>
    <header className="articleHero"><small>{article.video.channelTitle} · {article.video.duration}</small><h1>{article.title}</h1><p>{article.dek}</p></header>
    <div className="articleLayout">
      <aside className="toc"><b>이 영상의 흐름</b>{article.sections.map((s, i) => <a key={i} href={`#section-${i}`}><em>{formatTime(s.startSec)}</em>{s.headline}</a>)}</aside>
      <div>
        {article.sections.map((s, i) => <section className="articleSection" id={`section-${i}`} key={i}>
          <a className="timestamp" href={`https://www.youtube.com/watch?v=${article.video.id}&t=${Math.floor(s.startSec)}s`} target="_blank" rel="noreferrer">{formatTime(s.startSec)} 원본 영상 ↗</a>
          <h2>{s.headline}</h2>
          {s.body.split("\n").filter(Boolean).map((p, n) => <p key={n}>{p}</p>)}
          <details className="evidence"><summary>이 대목의 자막 근거</summary><p>{s.evidence || "해당 시점의 자막을 표시할 수 없습니다."}</p></details>
        </section>)}
      </div>
    </div>
  </article>;
}

function delayHint(stage: AnalyzeStage, elapsed: number) {
  if (elapsed < 7) return "실제 서버 단계가 끝날 때만 다음 단계로 넘어갑니다.";
  if (stage === "video") return "YouTube에서 영상 정보를 받는 중입니다.";
  if (stage === "transcript") return "자막이 길거나 YouTube 응답이 느리면 조금 더 걸릴 수 있습니다.";
  if (stage === "structure") return "전체 흐름을 읽고 주제 전환점을 고르는 중입니다.";
  if (stage === "grounding") return "각 대목을 실제 자막 위치와 다시 맞추고 있습니다.";
  return "마무리하고 있습니다.";
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
