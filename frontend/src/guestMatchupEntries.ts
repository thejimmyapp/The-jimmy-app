import type { GuestMatchupClassifiedMatch, GuestMatchupEntry } from "./types";

export const isRealMatch = (match: GuestMatchupEntry): match is GuestMatchupClassifiedMatch => !("placeholder" in match);
