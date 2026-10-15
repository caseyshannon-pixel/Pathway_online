// "Still stuck? Email us" under an error message.
export default function HelpLink({ href, label = "Still stuck? Email us" }: { href: string; label?: string }) {
  return (
    <p className="help-link">
      <a href={href}>{label}</a>
    </p>
  );
}
