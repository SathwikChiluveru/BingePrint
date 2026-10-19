import { SAMPLE_VERSUS } from "./sampleData";

const AVATARS = [
  { initial: "Y", label: "You", lead: true },
  { initial: "R", label: "Roommate", lead: false },
  { initial: "G", label: "Group chat admin", lead: false },
];

/**
 * "Then your friends get theirs" as something you can see, in the first viewport.
 * Phones get a one-frame sample of the group versus (the full reel sits below the fold there);
 * from md the reel itself opens on that frame, so this steps down to a row of group members.
 */
export function FriendsProof() {
  const [you, roommate] = SAMPLE_VERSUS;
  return (
    <>
      <figure
        className="m-0 rounded-[16px] px-3 py-2.5 md:hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <figcaption className="text-sm font-semibold">Then your friends get theirs.</figcaption>
          <span
            className="shrink-0 rounded-[6px] px-1.5 py-0.5 text-xs font-semibold"
            style={{
              background: "var(--color-surface-2)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Sample
          </span>
        </div>
        <p className="sr-only">
          Sample group: {you.name} {you.value} titles, {roommate.name} {roommate.value} titles.
        </p>
        <div aria-hidden="true" className="mt-1 flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-semibold">{you.name}</span>
            <span className="text-2xl font-black tabular-nums min-[360px]:text-3xl" style={{ lineHeight: 1, letterSpacing: "-0.04em" }}>
              {you.value}
            </span>
          </span>
          <span className="text-xs font-semibold uppercase" style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}>
            vs
          </span>
          <span className="flex min-w-0 items-baseline gap-2" style={{ color: "var(--color-text-secondary)" }}>
            <span
              className="text-2xl font-black tabular-nums min-[360px]:text-3xl"
              style={{ lineHeight: 1, letterSpacing: "-0.04em" }}
            >
              {roommate.value}
            </span>
            <span className="text-sm font-semibold">{roommate.name}</span>
          </span>
        </div>
      </figure>

      <div className="hidden items-center gap-3 md:flex xl:justify-end">
        <span aria-hidden="true" className="flex">
          {AVATARS.map((a, i) => (
            <span
              key={a.initial}
              title={a.label}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black"
              style={{
                marginLeft: i === 0 ? 0 : -10,
                background: a.lead ? "var(--color-text)" : "var(--color-surface-3)",
                color: a.lead ? "var(--color-bg)" : "var(--color-text-secondary)",
                border: "2px solid var(--color-bg)",
              }}
            >
              {a.initial}
            </span>
          ))}
        </span>
        <span className="text-base font-semibold lg:text-lg">Then your friends get theirs.</span>
      </div>
    </>
  );
}
