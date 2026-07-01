// Ghostddit user routes — https://ghostddit.pages.dev
//
// Ghostddit documents user views at /user/USERNAME, with query params such as
// ?type=comment and ?sort=top. No documented JSON endpoint was found.

const BASE = "https://ghostddit.pages.dev";

export type GhostdditUserType = "post" | "comment";
export type GhostdditSort = "new" | "hot" | "old" | "top" | "comments";

function cleanUsername(username: string) {
  return username.trim().replace(/^u\//i, "");
}

export function ghostdditUserUrl(
  username: string,
  options: { type?: GhostdditUserType; sort?: GhostdditSort } = {},
) {
  const url = new URL(`/user/${encodeURIComponent(cleanUsername(username))}`, BASE);
  if (options.type === "comment") url.searchParams.set("type", "comment");
  if (options.sort && options.sort !== "new") url.searchParams.set("sort", options.sort);
  return url.toString();
}
