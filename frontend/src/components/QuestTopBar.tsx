import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AccountSummary } from "../api";
import type { GuestSessionIdentity } from "../guestChrome";
import { formatQuestCountdown } from "../quest";
import { AccountActions } from "./AccountActions";
import { AccountClaimForm } from "./AccountClaimForm";

interface QuestTopBarProps {
  questDeadline: number | null;
  questCompleted: boolean;
  questRemaining: number | null;
  guestSession: GuestSessionIdentity;
  account: AccountSummary | null;
  accountLoading: boolean;
  onClaimAccount: (email: string) => Promise<AccountSummary>;
  onAccountClaimed: (account: AccountSummary) => void;
}

export function QuestTopBar({ questDeadline, questCompleted, questRemaining, guestSession, account, accountLoading, onClaimAccount, onAccountClaimed }: QuestTopBarProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const visible = (questDeadline !== null && !questCompleted) || questCompleted;
  if (!visible) return null;

  const stagePanel = document.getElementById("app-stage-panel");
  const publishedCount = Math.min(3, guestSession.saved_moment_count);

  return (
    <>
      <header className="quest-topbar">
        <div className="quest-topbar-state">
          {questCompleted ? (
            <strong data-copy-placeholder>[COPY-PLACEHOLDER] Quest complete</strong>
          ) : (
            <strong role="timer" aria-label="Quest countdown">{formatQuestCountdown(questRemaining ?? 0)}</strong>
          )}
          <span role="status" aria-label="Quest progress" data-testid="quest-progress">{publishedCount}/3 learning moments published</span>
        </div>
        <AccountActions completed={guestSession.completed} onSignUp={() => setClaimOpen(true)} />
      </header>
      {claimOpen && stagePanel && createPortal(
        <div className="quest-account-claim-backdrop" data-onboarding-active-panel>
          <section className="quest-account-claim-panel" role="dialog" aria-modal="true" aria-label="Claim your identity">
            <button type="button" className="quest-account-claim-close" aria-label="Close" onClick={() => setClaimOpen(false)}><X size={18} /></button>
            <AccountClaimForm account={account} accountLoading={accountLoading} onClaimAccount={onClaimAccount} onAccountClaimed={onAccountClaimed} />
          </section>
        </div>,
        stagePanel,
      )}
    </>
  );
}
