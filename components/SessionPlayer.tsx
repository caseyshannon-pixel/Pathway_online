"use client";

import { useEffect, useRef, useState } from "react";
import Prose from "./Prose";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  session: number;
  youtubeId: string;
  alreadyCompleted: boolean;
  nextHref: string;
  nextLabel: string;
  /** Admin preview: play normally, but never record anything. */
  preview?: boolean;
  /** Picture shown over the video until someone presses play. */
  thumbnailUrl?: string;
  /** Shown in the completion banner (what happens next). */
  afterText?: string;
};

// A session only counts if at least this much of the video was actually played.
const REQUIRED_FRACTION = 0.85;

const SKIPPED_MESSAGE =
  "It looks like part of the video was skipped. Replay it from the start to finish this session.";

function loadYouTubeApi(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

export default function SessionPlayer({
  session,
  youtubeId,
  alreadyCompleted,
  nextHref,
  nextLabel,
  preview = false,
  thumbnailUrl = "",
  afterText = "",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(alreadyCompleted);
  const [message, setMessage] = useState<string | null>(null);
  // "info" is a gentle nudge (amber); "error" is a real problem (red).
  const [tone, setTone] = useState<"info" | "error">("error");
  const [problem, setProblem] = useState<"none" | "retry" | "signin">("none");
  const finishRef = useRef<() => void>(undefined);
  // With a thumbnail, YouTube's player only loads once someone presses play.
  const [started, setStarted] = useState(!thumbnailUrl);

  useEffect(() => {
    if (!started) return;
    let player: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let beatTimer: ReturnType<typeof setInterval> | null = null;
    let watched = 0;
    let cancelled = false;

    const stopTimer = () => {
      if (timer) clearInterval(timer);
      if (beatTimer) clearInterval(beatTimer);
      timer = null;
      beatTimer = null;
    };

    // Tells the server the video is playing, so it can count real watch time.
    const sendBeat = () =>
      preview
        ? Promise.resolve()
        : fetch("/api/progress/beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          duration: player?.getDuration?.() ?? 0,
          rate: player?.getPlaybackRate?.() ?? 1,
        }),
      }).catch(() => undefined);

    async function finish() {
      setProblem("none");
      if (preview) {
        setMessage(null);
        setDone(true);
        return;
      }
      await sendBeat();
      const duration = player?.getDuration?.() ?? 0;
      if (duration > 0 && watched < duration * REQUIRED_FRACTION) {
        setTone("info");
        setMessage(SKIPPED_MESSAGE);
        return;
      }
      if (alreadyCompleted) {
        setDone(true);
        return;
      }
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session }),
        });
        if (res.status === 401) {
          setTone("error");
          setMessage("Your sign-in expired, so this session couldn't be saved. Sign in again and watch it once more.");
          setProblem("signin");
          return;
        }
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (body.error === "not_watched") {
            setTone("info");
            setMessage(SKIPPED_MESSAGE);
            return;
          }
        }
        if (!res.ok) throw new Error("save failed");
        setMessage(null);
        setDone(true);
      } catch {
        setTone("error");
        setMessage("We couldn't save your progress. Please check your connection and try again.");
        setProblem("retry");
      }
    }
    finishRef.current = () => void finish();

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      const target = document.createElement("div");
      mountRef.current.appendChild(target);
      player = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: thumbnailUrl ? 1 : 0 },
        events: {
          onStateChange: (e: any) => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) {
              stopTimer();
              timer = setInterval(() => {
                watched += player?.getPlaybackRate?.() ?? 1;
              }, 1000);
              void sendBeat();
              beatTimer = setInterval(() => void sendBeat(), 10_000);
            } else if (e.data === S.ENDED) {
              stopTimer();
              void finish();
            } else {
              stopTimer();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      stopTimer();
      try {
        player?.destroy?.();
      } catch {
        /* player already gone */
      }
    };
  }, [session, youtubeId, alreadyCompleted, preview, started, thumbnailUrl]);

  return (
    <div>
      <div className="player-wrap" ref={mountRef}>
        {!started && (
          <button
            type="button"
            className="poster"
            onClick={() => setStarted(true)}
            aria-label="Play video"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="" onError={() => setStarted(true)} />
            <span className="poster-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {message && (
        <p
          className={tone === "info" ? "notice notice-info" : "notice"}
          role={tone === "info" ? "status" : "alert"}
        >
          {message}
        </p>
      )}
      {problem === "retry" && (
        <button type="button" className="btn" onClick={() => finishRef.current?.()}>
          Try Again
        </button>
      )}
      {problem === "signin" && (
        <a className="btn" href={`/api/auth/login?next=${encodeURIComponent(`/course/${session}`)}`}>
          Sign In Again
        </a>
      )}
      {done && (
        <div className="done-banner" role="status">
          <strong>
            Session {session} complete{preview ? " (preview, nothing was saved)" : ""}.
          </strong>
          <a className="btn" href={nextHref}>{nextLabel}</a>
          {afterText && <Prose text={afterText} className="done-after" />}
        </div>
      )}
    </div>
  );
}
