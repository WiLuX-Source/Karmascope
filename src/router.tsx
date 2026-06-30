import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./App";
import { normalizeUsername } from "./lib/userRoute";

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

const routeTree = rootRoute.addChildren([indexRoute, userRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function UserRoute() {
  const { username } = userRoute.useParams();
  const navigate = userRoute.useNavigate();

  function handleUsernameSubmit(value: string) {
    const next = normalizeUsername(value);
    if (!next || next === username) return;

    navigate({
      to: "/u/$username",
      params: { username: next },
      search: true,
      hash: true,
    });
  }

  return <App username={username} onUsernameSubmit={handleUsernameSubmit} />;
}

function IndexRoute() {
  const navigate = indexRoute.useNavigate();

  function handleUsernameSubmit(value: string) {
    const next = normalizeUsername(value);
    if (!next) return;

    navigate({
      to: "/u/$username",
      params: { username: next },
      search: true,
      hash: true,
    });
  }

  return <App username="" onUsernameSubmit={handleUsernameSubmit} />;
}
