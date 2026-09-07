# Legal delta for the live identity-claim flow — September 2026

> Every sentence in an `[OWNER-APPROVAL-REQUIRED]` block is new law-facing copy. Ship owner-approved copy verbatim or not at all.

## 1. Gap statement

- The claim stores `email`, `account_token`, guest link, and `created_at`; its completion ordinal is joined from the guest completion (`thejimmyapp/db.py:112-124`, `thejimmyapp/db.py:1082-1092`).
- `jimmy_guest_identity` and `jimmy_account_token` are HttpOnly, SameSite=Lax cookies with one-year maximum ages (`backend/main.py:76-77`, `backend/main.py:125-144`).
- `/api/accounts/me` returns guest number, email, completion ordinal, founder eligibility, and creation time, or null (`backend/main.py:147-155`, `backend/main.py:371-377`).
- The policy says, “The service does not currently offer user accounts or an automated deletion dashboard, and it does not currently apply a guaranteed automatic deletion period.” (`frontend/src/components/LegalPage.tsx:66`). The Terms say, “Because the current service has no user accounts, there is no account-termination workflow.” (`frontend/src/components/LegalPage.tsx:110`).
- The browser-storage paragraph says saved moments exclude cookies but does not disclose these server-set cookies (`frontend/src/components/LegalPage.tsx:55`).

## 2. Exact replacement text

### a. Privacy — follow `Information we process` at line 48

**[OWNER-APPROVAL-REQUIRED — EVERY SENTENCE IN THIS BLOCK]**

```tsx
<p><strong>Guest identity and claimed identity.</strong> We use an HttpOnly guest-identity cookie to recognize your numbered guest identity. After completing the quest, a guest may claim an identity using only an email address. We store the email, guest-number link, random account token, creation time, and founder completion ordinal to recognize and display the claimed identity. We collect no password for this claim. We retain the record until verified deletion, service maintenance, or it is no longer needed to operate the prototype. To request deletion, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address on file and identify the claimed identity.</p>
```

Grounding: `frontend/src/components/AccountClaimForm.tsx:39-44`; `backend/main.py:343-368`; `thejimmyapp/db.py:112-124`.

### b. Privacy — replace line 66

**[OWNER-APPROVAL-REQUIRED — EVERY SENTENCE IN THIS BLOCK]**

```tsx
<p>Claimed identities, game records, and collaboration content are stored in application databases operated with our hosting infrastructure. Browser preferences, guest progress, and saved learning moments remain in your browser until you use “Clear guest progress” or clear browser storage. That local reset does not delete a claimed identity, imported games, or shared rooms. A claimed identity is an email-linked guest record without password-based or cross-device sign-in. The service does not currently offer an automated deletion dashboard, and it does not currently apply a guaranteed automatic deletion period. Records remain until verified deletion, service maintenance, or they are no longer needed to operate the prototype.</p>
```

### c. Privacy — follow the browser-storage item at line 55

**[OWNER-APPROVAL-REQUIRED — EVERY SENTENCE IN THIS BLOCK]**

```tsx
<li><strong>Cookies.</strong> We set the HttpOnly <code>jimmy_guest_identity</code> cookie to recognize a numbered guest and the HttpOnly <code>jimmy_account_token</code> cookie to recognize a claimed identity. Each has a one-year lifetime and accompanies requests to the service.</li>
```

Grounding: `backend/main.py:76-77`, `backend/main.py:125-144`, `backend/main.py:371-377`.

### d. Terms — replace line 110

**[OWNER-APPROVAL-REQUIRED — EVERY SENTENCE IN THIS BLOCK]**

```tsx
<p>We may restrict use, remove unlawful or unsafe content, close review rooms, disable or remove a claimed identity, or discontinue the service when reasonably necessary. A claimed identity is a completed guest identity linked to an email and account cookie, without password-based or cross-device sign-in. You may request its removal under the Privacy Policy. We may disable it for Terms violations, safety, or operational necessity; disabling ends account-token recognition but does not itself delete records retained under the Privacy Policy.</p>
```

### e. Privacy and Terms eyebrows — replace lines 44 and 87

**[OWNER-APPROVAL-REQUIRED — EACH BLOCK]** Owner sets the adoption date.

```tsx
<p className="legal-eyebrow">Effective [OWNER DATE]</p>
```

```tsx
<p className="legal-eyebrow">Effective [OWNER DATE]</p>
```

### f. Claim-form disclosure — follow the email input at line 42

**[COPY-PLACEHOLDER] [OWNER-APPROVAL-REQUIRED]** (≤25 words)

```tsx
<p>We use your email to claim this guest identity; read how we store and delete it in our <a href="/privacy">Privacy Policy</a>.</p>
```

## 3. Test impact

- None break if adopted verbatim. Line 66’s replacement preserves “does not currently apply a guaranteed automatic deletion period,” so `LegalPage.test.tsx:10` stays true.
- `LegalPage.test.tsx:9,11-12,19-21` cover unchanged copy. Eyebrow dates and line 110’s no-account sentence are not asserted.
- Adoption should add claimed-identity and cookie-disclosure assertions; no test edit belongs here.

## 4. Out of scope

Magic-link, password, and Chess.com OAuth disclosures remain pending the credential-intake ruling and are not proposed here (`docs/MEMO-credential-intake-2026-09.md:14-20`).
