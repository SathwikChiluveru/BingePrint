import { Fragment } from "react";

/** Renders "~" visually and "about" for screen readers, which would otherwise say "tilde". */
export default function Approx({ text }: { text: string }) {
  const parts = text.split("~");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <span aria-hidden="true">~</span>
              <span className="sr-only">about </span>
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}
