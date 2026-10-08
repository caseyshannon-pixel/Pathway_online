// What the sign-in page says until an admin edits it (Admin > Sign-In Page).

export type SignInContent = {
  /** Small line above the heading, e.g. the church name. */
  eyebrow: string;
  heading: string;
  intro: string;
  /** Up to five short "what to expect" points. */
  bullets: string[];
  buttonLabel: string;
  /** Small reassurance under the button. */
  helpText: string;
  /** Optional picture across the top. */
  imageUrl: string;
};

export const DEFAULT_SIGNIN: SignInContent = {
  eyebrow: "The Rock",
  heading: "Pathway Online",
  intro:
    "Welcome to Pathway. Watch a short video each session, at your own pace and on any device. Your progress is saved, so you can stop and pick up later.",
  bullets: [],
  buttonLabel: "Sign in with Planning Center",
  helpText:
    "Use the email address The Rock has for you. If you're asked to create a Planning Center login, use that same email.",
  imageUrl: "",
};
