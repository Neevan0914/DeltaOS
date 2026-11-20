// The Games app shows exactly one itch.io creator page and nothing else.
export const GAMES_HOST = "anyware-studios.itch.io";
export const GAMES_HOME = `https://${GAMES_HOST}/`;
export const GAMES_PARTITION = "persist:games";

/** True only for https pages on the Anyware Studios itch.io subdomain (its page and its game pages). */
export function isGamesUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === GAMES_HOST;
  } catch {
    return false;
  }
}
