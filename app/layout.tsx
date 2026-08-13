import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrameBrief — 영상을 읽는 글로",
  description: "YouTube 영상을 시간축이 살아있는 읽기 좋은 글로 정리합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
