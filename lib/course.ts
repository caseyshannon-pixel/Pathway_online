// The default course content, used until an admin saves changes in /admin/content
// (saved content lives in Vercel Blob and takes over from this list).
//
// youtubeId is the part of the YouTube link after "v=" (or after "youtu.be/").
// Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ  ->  "dQw4w9WgXcQ"
// Leave it as "" until the video is ready; the session shows "coming soon".

export type SessionLink = { label: string; url: string };

export type SessionForm = { title: string; url: string };

export type Session = {
  number: number;
  title: string;
  youtubeId: string;
  /** Short intro shown above the video. */
  description: string;
  /** Extra notes shown below the video. Blank line = new paragraph. */
  notes: string;
  links: SessionLink[];
  /** Church Center forms shown below the video (up to 5). Empty = no form section. */
  forms: SessionForm[];
  /** Video length in seconds; 0 = not set. Used to check people really watched it. */
  lengthSeconds: number;
  /** Picture shown over the video until someone presses play. Empty = show the player. */
  thumbnailUrl: string;
  /** Shown when someone finishes this session, e.g. what happens next. */
  afterText: string;
};

const blank = { description: "", notes: "", links: [], forms: [], lengthSeconds: 0, thumbnailUrl: "", afterText: "" };

export const DEFAULT_SESSIONS: Session[] = [
  { number: 1, title: "Session 1", youtubeId: "r7HR7Xsro8M", ...blank },
  { number: 2, title: "Session 2", youtubeId: "RuX2hoWhMSw", ...blank },
  { number: 3, title: "Session 3", youtubeId: "hpF6VZGnma4", ...blank },
  { number: 4, title: "Session 4", youtubeId: "piUMnulRBI8", ...blank },
  { number: 5, title: "Session 5", youtubeId: "", ...blank },
  { number: 6, title: "Session 6", youtubeId: "", ...blank },
];
