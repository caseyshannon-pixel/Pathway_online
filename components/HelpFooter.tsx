"use client";

import { usePathname } from "next/navigation";
import { HELP_EMAIL, helpHref } from "@/lib/help";

// "Need help?" at the bottom of every page. The email it opens says who is writing
// and which page they were on.
export default function HelpFooter({ name }: { name: string }) {
  const path = usePathname();
  return (
    <footer className="site-footer">
      Need help? <a href={helpHref({ name, path })}>Email {HELP_EMAIL}</a>
    </footer>
  );
}
