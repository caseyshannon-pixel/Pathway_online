// The section under "Welcome, [name]" on the course page (Admin > Welcome Section).
// Nothing shows until an admin fills it in.

export type WelcomeContent = {
  thankYouTitle: string;
  thankYou: string;
  expectTitle: string;
  /** Up to six short points. */
  expectPoints: string[];
  whatNowTitle: string;
  whatNow: string;
  /** Up to six short next steps. */
  whatNowPoints: string[];
  /** Hide the whole section once someone has finished their first session. */
  hideAfterStart: boolean;
};

export const DEFAULT_WELCOME: WelcomeContent = {
  thankYouTitle: "Thank you",
  thankYou: "",
  expectTitle: "What to expect",
  expectPoints: [],
  whatNowTitle: "What now?",
  whatNow: "",
  whatNowPoints: [],
  hideAfterStart: false,
};

export const hasWelcomeContent = (c: WelcomeContent) =>
  Boolean(c.thankYou) || c.expectPoints.length > 0 || Boolean(c.whatNow) || c.whatNowPoints.length > 0;
