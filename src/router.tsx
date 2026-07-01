import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./App";
import { SubredditApp } from "./SubredditApp";
import { normalizeSubreddit, normalizeUsername, type RedditKind } from "./lib/userRoute";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/u/$username",
  component: UserRoute,
});

const subredditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/r/$subreddit",
  component: SubredditRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, userRoute, subredditRoute]);

const basepath =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createRouter({ routeTree, basepath });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function UserRoute() {
  const { username } = userRoute.useParams();
  const navigate = userRoute.useNavigate();

  function handleSubmit(kind: RedditKind, value: string) {
    if (kind === "subreddit") {
      const next = normalizeSubreddit(value);
      if (!next) return;
      navigate({ to: "/r/$subreddit", params: { subreddit: next }, search: true, hash: true });
      return;
    }

    const next = normalizeUsername(value);
    if (!next || next === username) return;
    navigate({ to: "/u/$username", params: { username: next }, search: true, hash: true });
  }

  return <App username={username} onHandleSubmit={handleSubmit} />;
}

function SubredditRoute() {
  const { subreddit } = subredditRoute.useParams();
  const navigate = subredditRoute.useNavigate();

  function handleSubmit(kind: RedditKind, value: string) {
    if (kind === "user") {
      const next = normalizeUsername(value);
      if (!next) return;
      navigate({ to: "/u/$username", params: { username: next }, search: true, hash: true });
      return;
    }

    const next = normalizeSubreddit(value);
    if (!next || next === subreddit) return;
    navigate({ to: "/r/$subreddit", params: { subreddit: next }, search: true, hash: true });
  }

  return <SubredditApp subreddit={subreddit} onHandleSubmit={handleSubmit} />;
}

function IndexRoute() {
  const navigate = indexRoute.useNavigate();

  function handleSubmit(kind: RedditKind, value: string) {
    if (kind === "subreddit") {
      const next = normalizeSubreddit(value);
      if (!next) return;
      navigate({ to: "/r/$subreddit", params: { subreddit: next }, search: true, hash: true });
      return;
    }

    const next = normalizeUsername(value);
    if (!next) return;
    navigate({ to: "/u/$username", params: { username: next }, search: true, hash: true });
  }

  return <App username="" onHandleSubmit={handleSubmit} />;
}
