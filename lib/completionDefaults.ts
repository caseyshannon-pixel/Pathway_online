// The screen shown when someone finishes every session (Admin > Edit Session Content).

export type CompletionAction = { label: string; url: string };

export type CompletionContent = {
  heading: string;
  message: string;
  /** Optional picture across the top. */
  imageUrl: string;
  /** Up to three buttons, such as a next step. */
  actions: CompletionAction[];
};

export const DEFAULT_COMPLETION: CompletionContent = {
  heading: "Congratulations!",
  message: "You've finished Pathway. You can rewatch any session below.",
  imageUrl: "",
  actions: [],
};
