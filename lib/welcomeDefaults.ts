// The section under "Welcome, [name]" on the course page (Admin > Welcome Section).
// Nothing shows until an admin fills it in.

export type WelcomeContent = {
  thankYouTitle: string;
  thankYou: string;
  expectTitle: string;
  /** Up to six short points. */
  expectPoints: string[];
  /** Hide the whole section once someone has finished their first session. */
  hideAfterStart: boolean;
};

export const DEFAULT_WELCOME: WelcomeContent = {
  thankYouTitle: "Thank you",
  thankYou: "",
  expectTitle: "What to expect",
  expectPoints: [],
  hideAfterStart: false,
};

export const hasWelcomeContent = (c: WelcomeContent) => Boolean(c.thankYou) || c.expectPoints.length > 0;
