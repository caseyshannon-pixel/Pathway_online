"use client";

import { useEffect, useRef, useState } from "react";

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
};

// A session only counts if at least this much of the video was actually played.
const REQUIRED_FRACTION = 0.85;

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
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(alreadyCompleted);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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
      if (preview) {
        setMessage(null);
        setDone(true);
        return;
      }
      await sendBeat();
      const duration = player?.getDuration?.() ?? 0;
      if (duration > 0 && watched < duration * REQUIRED_FRACTION) {
        setMessage("Watch the whole session to finish it. You can replay it from the start.");
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
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (body.error === "not_watched") {
            setMessage("Watch the whole session to finish it. You can replay it from the start.");
            return;
          }
        }
        if (!res.ok) throw new Error("save failed");
        setMessage(null);
        setDone(true);
      } catch {
        setMessage("We couldn't save your progress. Check your connection and replay the last few seconds to try again.");
      }
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      const target = document.createElement("div");
      mountRef.current.appendChild(target);
      player = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
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
  }, [session, youtubeId, alreadyCompleted, preview]);

  return (
    <div>
      <div className="player-wrap" ref={mountRef} />
      {message && <p className="notice" role="alert">{message}</p>}
      {done && (
        <div className="done-banner" role="status">
          <strong>
            Session {session} complete{preview ? " (preview, nothing was saved)" : ""}.
          </strong>
          <a className="btn" href={nextHref}>{nextLabel}</a>
        </div>
      )}
    </div>
  );
}
