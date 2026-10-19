import Link from "next/link";

function ArrowLeft() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/** 44px back control to the group page. */
export default function BackLink({ groupId, label }: { groupId: string; label: string }) {
  return (
    <Link
      href={`/groups/${encodeURIComponent(groupId)}`}
      className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
    >
      <ArrowLeft />
      <span className="max-w-[16rem] truncate">{label}</span>
    </Link>
  );
}
