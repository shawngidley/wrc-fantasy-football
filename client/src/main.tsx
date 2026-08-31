import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
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

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
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
