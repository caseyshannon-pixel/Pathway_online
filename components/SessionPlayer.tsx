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

const RATES = [1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const CC_PREF = "pathway_captions";

// Turns YouTube's captions on or off. (YouTube's player has no documented call for
// this; these module calls are the widely used way.)
function applyCaptions(player: any, on: boolean) {
  try {
    if (on) {
      player.loadModule?.("captions");
      const tracks = (player.getOption?.("captions", "tracklist") as any[]) ?? [];
      if (tracks.length > 0) {
        const pick = tracks.find((t) => String(t.languageCode ?? "").startsWith("en")) ?? tracks[0];
        player.setOption?.("captions", "track", { languageCode: pick.languageCode });
      }
    } else {
      player.setOption?.("captions", "track", {});
      player.unloadModule?.("captions");
    }
  } catch {
    /* captions module not ready yet */
  }
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
    <path d={d} />
  </svg>
);
const PlayIcon = () => <Icon d="M8 5v14l11-7z" />;
const PauseIcon = () => <Icon d="M6 5h4v14H6zm8 0h4v14h-4z" />;
const VolumeIcon = () => (
  <Icon d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z" />
);
const MutedIcon = () => (
  <Icon d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
);
const FullscreenIcon = () => <Icon d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />;

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
  const [problem, setProblem] = useState<"none" | "retry" | "signin">("none");
  const finishRef = useRef<() => void>(undefined);
  const playerRef = useRef<any>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // custom controls
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [ccOn, setCcOn] = useState(false);
  const [ccNote, setCcNote] = useState<string | null>(null);
  const [fsSupported, setFsSupported] = useState(false);

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
      setProblem("none");
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
        if (res.status === 401) {
          setMessage("Your sign-in expired, so this session couldn't be saved. Sign in again and watch it once more.");
          setProblem("signin");
          return;
        }
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
        // controls: 0 hides YouTube's own control bar; we draw ours below the video.
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            setDuration(player.getDuration?.() ?? 0);
            setReady(true);
            let wantCaptions = false;
            try {
              wantCaptions = localStorage.getItem(CC_PREF) === "1";
            } catch {
              /* storage blocked */
            }
            if (wantCaptions) {
              setCcOn(true);
              applyCaptions(player, true);
            }
          },
          onStateChange: (e: any) => {
            const S = YT.PlayerState;
            setPlaying(e.data === S.PLAYING);
            setEnded(e.data === S.ENDED);
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

    // keep the time, speed and mute readouts current
    const ticker = setInterval(() => {
      if (!player?.getCurrentTime) return;
      setTime(player.getCurrentTime());
      const d = player.getDuration?.();
      if (d) setDuration(d);
      setRate(player.getPlaybackRate?.() ?? 1);
      setMuted(Boolean(player.isMuted?.()));
    }, 300);

    return () => {
      cancelled = true;
      clearInterval(ticker);
      playerRef.current = null;
      stopTimer();
      try {
        player?.destroy?.();
      } catch {
        /* player already gone */
      }
    };
  }, [session, youtubeId, alreadyCompleted, preview]);

  useEffect(() => {
    const d = document as any;
    setFsSupported(Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled));
  }, []);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.();
    else {
      if (ended) p.seekTo?.(0, true);
      p.playVideo?.();
    }
  };

  const commitSeek = () => {
    if (scrub === null) return;
    playerRef.current?.seekTo?.(scrub, true);
    setTime(scrub);
    setScrub(null);
  };

  const cycleRate = () => {
    const p = playerRef.current;
    if (!p) return;
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
    p.setPlaybackRate?.(next);
    setRate(next);
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) p.unMute?.();
    else p.mute?.();
    setMuted(!muted);
  };

  const toggleCaptions = () => {
    const p = playerRef.current;
    if (!p) return;
    const next = !ccOn;
    setCcOn(next);
    setCcNote(null);
    applyCaptions(p, next);
    try {
      localStorage.setItem(CC_PREF, next ? "1" : "0");
    } catch {
      /* storage blocked */
    }
    if (next) {
      // If YouTube reports no caption tracks, say so instead of doing nothing.
      setTimeout(() => {
        const tracks = playerRef.current?.getOption?.("captions", "tracklist");
        if (Array.isArray(tracks) && tracks.length === 0) {
          setCcNote("Captions aren't available for this video yet.");
          setCcOn(false);
        }
      }, 1200);
    }
  };

  const toggleFullscreen = () => {
    const d = document as any;
    const el = shellRef.current as any;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
    } else {
      (el?.requestFullscreen ?? el?.webkitRequestFullscreen)?.call(el);
    }
  };

  const shown = scrub ?? time;

  return (
    <div>
      <div className="player-shell" ref={shellRef}>
        <div className="player-wrap" ref={mountRef} />
        <div className="player-controls" role="group" aria-label="Video controls">
          <button
            type="button"
            className="pc-btn"
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? "Pause" : ended ? "Replay" : "Play"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="pc-time">
            {formatTime(shown)} / {formatTime(duration)}
          </span>
          <input
            className="pc-seek"
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            value={Math.min(Math.floor(shown), Math.max(1, Math.floor(duration)))}
            disabled={!ready || !duration}
            aria-label="Seek"
            aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
            style={{ ["--pct" as string]: `${duration ? (shown / duration) * 100 : 0}%` }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
            onBlur={commitSeek}
          />
          <button
            type="button"
            className="pc-btn pc-text"
            onClick={cycleRate}
            disabled={!ready}
            aria-label={`Playback speed ${rate} times. Change speed`}
          >
            {rate}x
          </button>
          <button
            type="button"
            className={`pc-btn pc-text${ccOn ? " is-on" : ""}`}
            onClick={toggleCaptions}
            disabled={!ready}
            aria-pressed={ccOn}
            aria-label="Closed captions"
          >
            CC
          </button>
          <button
            type="button"
            className="pc-btn"
            onClick={toggleMute}
            disabled={!ready}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MutedIcon /> : <VolumeIcon />}
          </button>
          {fsSupported && (
            <button type="button" className="pc-btn" onClick={toggleFullscreen} disabled={!ready} aria-label="Full screen">
              <FullscreenIcon />
            </button>
          )}
        </div>
      </div>
      {ccNote && <p className="muted pc-note" role="status">{ccNote}</p>}
      {message && <p className="notice" role="alert">{message}</p>}
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
        </div>
      )}
    </div>
  );
}
