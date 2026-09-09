import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialCapabilityMap } from "../guestProgress";
import { useCoachStore } from "../store";
import { SidePanel } from "./SidePanel";

const baseProps: Parameters<typeof SidePanel>[0] = {
  onSelectGame: vi.fn(),
  loadingGame: false,
  infoContent: <div>Review information</div>,
  savedLessons: [],
  qualifyingGames: 0,
  onOpenSavedLesson: vi.fn().mockResolvedValue(true),
  onRemoveSavedLesson: vi.fn(),
  initialTab: "collaborate",
  capabilities: initialCapabilityMap(),
};

const collaborateMarkup = () => [
  document.querySelector('[aria-label="Collaboration views"]')?.outerHTML,
  document.querySelector(".collaborate-pane")?.outerHTML,
].join("");

describe("SidePanel collaborate markup", () => {
  beforeEach(() => useCoachStore.setState({
    game: null,
    guestMatch: null,
    games: [],
    globalPly: 12,
    displayName: "Coach",
    roomId: null,
    participants: [],
    messages: [],
  }));
  afterEach(cleanup);

  it("pins the capability-locked collaborate section", () => {
    render(<SidePanel {...baseProps} />);
    expect(collaborateMarkup()).toMatchInlineSnapshot(`"<div class="utility-secondary-tabs" role="tablist" aria-label="Collaboration views"><button role="tab" aria-selected="true" class="active">Chat</button><button role="tab" aria-selected="false" class="">Notes</button></div><div class="utility-pane collaborate-pane"><div class="presence"><span class="presence-dot"></span><span>Solo review · <strong>Move 12</strong></span></div><div class="message-list"></div><form class="composer"><textarea placeholder="Message your partner" maxlength="5000"></textarea><button aria-label="Send"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg></button></form></div>"`);
  });

  it("pins the room collaborate section with messages, a note, and participants", () => {
    useCoachStore.setState({
      roomId: "room-42",
      participants: [
        { client_id: "alpha", display_name: "Coach" },
        { client_id: "beta", display_name: "Partner" },
      ],
      messages: [
        { id: "chat-1", author: "Coach", content: "Try N@h6", ply: 12, timestamp: "2026-09-09T01:00:00Z", sequence: 1 },
        { id: "chat-2", author: "Partner", content: "I see the fork", ply: 13, timestamp: "2026-09-09T01:00:01Z", sequence: 2 },
        { id: "note-1", author: "Coach", content: "Pinned note", ply: 12, timestamp: "2026-09-09T01:00:02Z", sequence: 3 },
      ],
    });
    render(<SidePanel {...baseProps} capabilities={{ ...initialCapabilityMap(), dock_collaborate: "unlocked" }} />);
    expect(collaborateMarkup()).toMatchInlineSnapshot(`"<div class="utility-secondary-tabs" role="tablist" aria-label="Collaboration views"><button role="tab" aria-selected="true" class="active">Chat</button><button role="tab" aria-selected="false" class="">Notes</button></div><div class="utility-pane collaborate-pane"><div class="presence"><span class="presence-dot"></span><span><strong>2</strong> watching · Coach, Partner</span></div><div class="message-list"><article><header><strong>Coach</strong><button title="Go to referenced move">A · 12</button></header><p>Try N@h6</p></article><article><header><strong>Partner</strong><button title="Go to referenced move">A · 13</button></header><p>I see the fork</p></article><article><header><strong>Coach</strong><button title="Go to referenced move">A · 12</button></header><p>Pinned note</p></article></div><form class="composer"><textarea placeholder="Message your partner" maxlength="5000"></textarea><button aria-label="Send"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg></button></form></div>"`);
  });
});
