import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ["session"],
      queryFn: () => getSession(),
      staleTime: 60_000,
    });
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
