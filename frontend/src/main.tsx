import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PuzzlePlayer } from "./components/PuzzlePlayer";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

const puzzleMatch = location.pathname.match(/^\/puzzle\/([a-f0-9]{40})\/?$/i);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {puzzleMatch ? <PuzzlePlayer puzzleId={puzzleMatch[1]} /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
);
