// A person's Planning Center photo, or their first initial if they have none.
export default function PersonAvatar({ name, src }: { name: string; src?: string }) {
  return (
    <span className="person-avatar" aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <span>{(name.trim().charAt(0) || "?").toUpperCase()}</span>
      )}
    </span>
  );
}
