// Helpers for treating on-chain and user-supplied text as UNTRUSTED data.
// Token names, symbols and similar strings are chosen by whoever deployed a contract,
// so they can contain instructions aimed at an AI model or at a reader. They are
// shortened and stripped of control and invisible characters before they leave the server.

// Control characters, zero-width and bidirectional-override characters.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function cleanText(value: unknown, max = 24): string {
  const text = String(value ?? '')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const WEI = 10n ** 18n;

/** Wei (as a decimal string) to a readable MON amount, no floating point. */
export function weiToMon(wei: string | bigint | undefined, decimals = 4): string {
  let value: bigint;
  try {
    value = BigInt(wei ?? '0');
  } catch {
    return '0';
  }
  const whole = value / WEI;
  const frac = (value % WEI).toString().padStart(18, '0').slice(0, decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function isoFromUnix(seconds: string | number | undefined): string | undefined {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : undefined;
}
