// The course content. Edit this file to rename sessions or add video IDs.
//
// youtubeId is the part of the YouTube link after "v=" (or after "youtu.be/").
// Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ  ->  "dQw4w9WgXcQ"
// Leave it as "" until the video is ready; the session shows "coming soon".

export type Session = {
  number: number;
  title: string;
  youtubeId: string;
};

export const SESSIONS: Session[] = [
  { number: 1, title: "Session 1", youtubeId: "r7HR7Xsro8M&feature=youtu.be" },
  { number: 2, title: "Session 2", youtubeId: "RuX2hoWhMSw" },
  { number: 3, title: "Session 3", youtubeId: "" },
  { number: 4, title: "Session 4", youtubeId: "" },
  { number: 5, title: "Session 5", youtubeId: "" },
  { number: 6, title: "Session 6", youtubeId: "" },
];
