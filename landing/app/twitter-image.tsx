// X reads its own `twitter:image` tag from this file's convention, separately from
// `opengraph-image.tsx` — same card, so this just re-exports everything from it. `runtime` is a
// route segment config export and can't be re-exported (Next requires it statically analyzable
// per-file); omitted here since Node is already this project's default runtime.
export { default, alt, size, contentType } from "./opengraph-image";
