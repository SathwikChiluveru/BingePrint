"use client";

import Link from "next/link";
import type { Group } from "@/types";
import InviteActions from "@/components/groups/InviteActions";
import BackLink from "./BackLink";

const shell = "mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-3 sm:px-6";

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-[var(--color-surface-2)] ${className}`} />;
}

/** Shape-only placeholder; the gentle pulse is skipped under reduced motion. */
export function CompareSkeleton() {
  return (
    <main className={shell}>
      <p role="status" className="sr-only">
        Loading the comparison
      </p>
      <div className="motion-safe:animate-pulse">
        <Bar className="h-11 w-36" />
        <Bar className="mt-6 h-9 w-11/12" />
        <Bar className="mt-2 h-9 w-2/3" />
        <Bar className="mx-auto mt-14 h-20 w-48" />
        <Bar className="mx-auto mt-3 h-5 w-32" />
        <div className="mt-16 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-4">
              <Bar className="h-5 w-1/2" />
              <Bar className="mt-3 h-1.5 w-full rounded-full" />
              <Bar className="mt-3 h-4 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export type LoadError = { kind: "signin" } | { kind: "not-member" } | { kind: "failed" };

export function CompareError({
  groupId,
  error,
  onRetry,
}: {
  groupId: string;
  error: LoadError;
  onRetry: () => void;
}) {
  const groupHref = `/groups/${encodeURIComponent(groupId)}`;
  const copy = {
    signin: {
      title: "Sign in to see who watched more.",
      body: "The comparison only opens for people in the group.",
    },
    "not-member": {
      title: "This comparison is for group members.",
      body: "You are not in this group yet, or it no longer exists. The group page can get you in with an invite.",
    },
    failed: {
      title: "The comparison did not load.",
      body: "Check your connection and try again. Your group is fine.",
    },
  }[error.kind];

  return (
    <main className={shell}>
      <BackLink groupId={groupId} label="Back to group" />
      <div role="alert" className="mt-10">
        <h1 className="text-headline font-bold">{copy.title}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">{copy.body}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {error.kind === "signin" && (
          <Link
            href={`/auth/login?next=${encodeURIComponent(`${groupHref}/compare`)}`}
            className="btn-primary px-6 py-3"
          >
            Sign in
          </Link>
        )}
        {error.kind === "failed" && (
          <button type="button" onClick={onRetry} className="btn-primary px-6 py-3">
            Try again
          </button>
        )}
        <Link href={groupHref} className={`${error.kind === "not-member" ? "btn-primary" : "btn-secondary"} px-6 py-3`}>
          Go to the group page
        </Link>
      </div>
    </main>
  );
}

export function CompareSolo({ group, ownedByMe }: { group: Group; ownedByMe: boolean }) {
  const count = group.members?.length ?? 0;
  return (
    <main className={shell}>
      <BackLink groupId={group.id} label={group.name} />
      <h1 className="text-headline mt-10 font-bold">Comparing unlocks when a second person joins.</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">
        {count === 0
          ? "Nobody has added a reel yet. Add yours from the group page, then send the invite."
          : "Right now there is nobody to lose to. Send the invite and find out who has the worse habit."}
      </p>
      <div className="mt-8">
        <InviteActions code={group.invite_code} groupName={group.name} sharePrimary ownedByMe={ownedByMe} />
      </div>
      <Link
        href={`/groups/${encodeURIComponent(group.id)}`}
        className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-text-secondary)] underline hover:text-[var(--color-text)]"
      >
        Back to the group page
      </Link>
    </main>
  );
}
