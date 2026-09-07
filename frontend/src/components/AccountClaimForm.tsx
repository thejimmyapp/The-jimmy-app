import { useState, type FormEvent } from "react";
import { ApiError, type AccountSummary } from "../api";

interface AccountClaimFormProps {
  account: AccountSummary | null;
  accountLoading: boolean;
  onClaimAccount: (email: string) => Promise<AccountSummary>;
  onAccountClaimed: (account: AccountSummary) => void;
}

export function AccountClaimForm({ account, accountLoading, onClaimAccount, onAccountClaimed }: AccountClaimFormProps) {
  const [email, setEmail] = useState("");
  const [claimPending, setClaimPending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedAccount, setClaimedAccount] = useState<AccountSummary | null>(null);
  const displayedAccount = claimedAccount ?? account;

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (claimPending) return;
    setClaimPending(true);
    setClaimError(null);
    try {
      const claimed = await onClaimAccount(email);
      setClaimedAccount(claimed);
      onAccountClaimed(claimed);
    } catch (error) {
      setClaimError(error instanceof ApiError && error.status === 422 ? "enter a valid email" : "Identity claim failed.");
    } finally {
      setClaimPending(false);
    }
  };

  return (
    <section className="guest-account-claim" aria-label="Claim your identity">
      {accountLoading && !displayedAccount ? <span role="status">Checking account…</span> : displayedAccount ? (
        <strong role="status">{displayedAccount.founder_eligible ? `Claimed — Founder #${displayedAccount.completion_ordinal}` : `Identity claimed (#${displayedAccount.completion_ordinal})`}</strong>
      ) : (
        <form noValidate onSubmit={submitClaim}>
          <strong>Claim your identity</strong>
          <label htmlFor="guest-account-email">Email</label>
          <input id="guest-account-email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" disabled={claimPending}>{claimPending ? "Claiming…" : "Claim your identity"}</button>
          {claimError && <span role="alert">{claimError}</span>}
        </form>
      )}
    </section>
  );
}
