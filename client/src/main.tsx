import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry a rate limit -- retrying it is what's likely to keep
        // it perpetually tripped instead of ever letting it reset, since
        // the default (3 retries with exponential backoff) turns every
        // single failed request into up to 4 actual HTTP calls to
        // whatever third-party API is rate-limiting us (confirmed
        // happening repeatedly with FantasyPros over several hours).
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("429") || /rate limit/i.test(message)) return false;
        // Otherwise, a couple of retries for genuinely transient failures
        // is reasonable, but the default of 3 is more aggressive than this
        // app's data (fantasy sports info, not anything time-critical)
        // actually needs.
        return failureCount < 2;
      },
    },
  },
});

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const commonLinkOptions = {
  url: "/api/trpc",
  transformer: superjson,
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
    });
  },
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // playerStats queries carry a playerNames array that can run into
      // the hundreds (Free Agents) -- large enough that even a single
      // one of these queries, on its own, can exceed a GET URL's usable
      // length. httpBatchLink's maxURLLength only splits a batch into
      // smaller GET requests; it has nothing left to split once it's
      // down to one oversized query, and throws rather than falling
      // back to POST. Routing these specific queries through a
      // dedicated, always-POST link sidesteps URL length entirely,
      // since POST puts the input in the request body, not the URL.
      condition: (op) => op.path.startsWith("playerStats."),
      true: httpLink({ ...commonLinkOptions, methodOverride: "POST" }),
      false: httpBatchLink({
        ...commonLinkOptions,
        // Safety net for any other query that happens to batch large
        // with others -- splits into smaller GET requests rather than
        // exceeding a URL length limit.
        maxURLLength: 2000,
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
