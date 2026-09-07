import { SIGN_IN_NOTICE } from "../guestChrome";

interface AccountActionsProps {
  completed: boolean;
  onSignUp?: () => void;
}

export function AccountActions({ completed, onSignUp }: AccountActionsProps) {
  return (
    <div className="account-actions">
      <button type="button" aria-label="Log in" title={SIGN_IN_NOTICE} disabled>Log in</button>
      <button type="button" aria-label="Sign up" title={SIGN_IN_NOTICE} disabled={!completed} onClick={onSignUp}>Sign up</button>
    </div>
  );
}
