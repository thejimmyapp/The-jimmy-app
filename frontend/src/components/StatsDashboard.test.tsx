import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerStats } from "../types";
import { StatsDashboard } from "./StatsDashboard";

const apiMock = vi.hoisted(() => ({ playerStats: vi.fn() }));
vi.mock("../api", () => ({ api: apiMock }));

const fixture: PlayerStats = {
  username: "Jimmy",
  summary: { total_games: 100, wins: 60, losses: 38, draws: 2, winrate: 60, partner_boards: 80, mistakes: 12, blunders: 3, avg_loss: 140, most_common_losing_pattern: "king net", most_common_tactical_miss: "fork", time_trouble_frequency: "20%" },
  colors: [{ color: "white", games: 50, wins: 32, losses: 18, winrate: 64 }, { color: "black", games: 50, wins: 28, losses: 20, winrate: 56 }],
  monthly: [{ month: "2026-07", games: 20, wins: 13, losses: 7, winrate: 65 }],
  rating_bands: [{ label: "2000-2199", games: 30, wins: 18, winrate: 60 }],
  partners: [{ partner: "RyanTime", games: 40, wins: 28, winrate: 70 }],
  opponents: [{ opponent: "Nemesis", games: 10, wins: 3, winrate: 30, avg_rating: 2100 }],
  mistake_categories: [{ category: "ignored partner danger", count: 8, avg_loss: 180, max_loss: 700 }],
  data_quality: { two_board_games: 80, total_games: 100, analysis_positions: 12 },
};

afterEach(cleanup);

describe("StatsDashboard", () => {
  it("renders useful performance signals from the player history", async () => {
    apiMock.playerStats.mockResolvedValue(fixture);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><StatsDashboard username="Jimmy" /></QueryClientProvider>);

    expect((await screen.findAllByText("60.0%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("RyanTime").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nemesis").length).toBeGreaterThan(0);
    expect(screen.getByText("ignored partner danger")).toBeTruthy();
  });
});
