// The App Store catalog: free web apps that run inside DeltaOS in their own app window.
// DRM-only services (Spotify, Netflix, Disney+) are left out: their players need Widevine, which DeltaOS doesn't ship.
export type WebAppCategory = "Productivity" | "Creativity" | "Social" | "Entertainment" | "Games" | "Learning" | "Tools";

export interface WebAppDef {
  id: string;
  name: string;
  publisher: string;
  url: string;
  /** Sites (and their subdomains) that stay inside the app window; other links open in Tesseract. */
  hosts: string[];
  category: WebAppCategory;
  description: string;
}

export const WEB_APPS: WebAppDef[] = [
  { id: "vscode", name: "VS Code for the Web", publisher: "Microsoft", url: "https://vscode.dev/", hosts: ["vscode.dev"], category: "Productivity", description: "Microsoft's code editor in the browser." },
  { id: "office", name: "Microsoft 365", publisher: "Microsoft", url: "https://www.office.com/", hosts: ["office.com", "microsoft365.com", "cloud.microsoft", "officeapps.live.com", "onedrive.live.com", "sharepoint.com"], category: "Productivity", description: "Free Word, Excel and PowerPoint online with a Microsoft account." },
  { id: "notion", name: "Notion", publisher: "Notion Labs", url: "https://www.notion.so/", hosts: ["notion.so", "notion.com"], category: "Productivity", description: "Notes, docs and wikis in one workspace." },
  { id: "trello", name: "Trello", publisher: "Atlassian", url: "https://trello.com/", hosts: ["trello.com", "atlassian.com"], category: "Productivity", description: "Boards, lists and cards to organise anything." },
  { id: "todoist", name: "Todoist", publisher: "Doist", url: "https://app.todoist.com/", hosts: ["todoist.com"], category: "Productivity", description: "A clean to-do list and task planner." },
  { id: "photopea", name: "Photopea", publisher: "Photopea", url: "https://www.photopea.com/", hosts: ["photopea.com"], category: "Creativity", description: "Photo editor that opens PSD, XCF and Sketch files." },
  { id: "canva", name: "Canva", publisher: "Canva", url: "https://www.canva.com/", hosts: ["canva.com"], category: "Creativity", description: "Design posters, slides and social posts." },
  { id: "excalidraw", name: "Excalidraw", publisher: "Excalidraw", url: "https://excalidraw.com/", hosts: ["excalidraw.com"], category: "Creativity", description: "Hand-drawn style whiteboard and diagrams." },
  { id: "tldraw", name: "tldraw", publisher: "tldraw", url: "https://www.tldraw.com/", hosts: ["tldraw.com"], category: "Creativity", description: "A fast, friendly infinite canvas." },
  { id: "discord", name: "Discord", publisher: "Discord", url: "https://discord.com/app", hosts: ["discord.com", "discord.gg", "discordapp.com"], category: "Social", description: "Chat with friends and communities." },
  { id: "whatsapp", name: "WhatsApp Web", publisher: "Meta", url: "https://web.whatsapp.com/", hosts: ["web.whatsapp.com", "whatsapp.com"], category: "Social", description: "Your WhatsApp chats; link it by scanning a QR code with your phone." },
  { id: "telegram", name: "Telegram Web", publisher: "Telegram", url: "https://web.telegram.org/", hosts: ["web.telegram.org", "telegram.org"], category: "Social", description: "Fast, cloud-based messaging." },
  { id: "youtube", name: "YouTube", publisher: "Google", url: "https://www.youtube.com/", hosts: ["youtube.com", "youtu.be"], category: "Entertainment", description: "Videos, music and creators." },
  { id: "soundcloud", name: "SoundCloud", publisher: "SoundCloud", url: "https://soundcloud.com/", hosts: ["soundcloud.com"], category: "Entertainment", description: "Stream music and podcasts from independent artists." },
  { id: "twitch", name: "Twitch", publisher: "Amazon", url: "https://www.twitch.tv/", hosts: ["twitch.tv"], category: "Entertainment", description: "Live streams of games, music and more." },
  { id: "lichess", name: "Lichess", publisher: "lichess.org", url: "https://lichess.org/", hosts: ["lichess.org"], category: "Games", description: "Free, open-source chess. No ads." },
  { id: "wordle", name: "Wordle", publisher: "The New York Times", url: "https://www.nytimes.com/games/wordle/index.html", hosts: ["nytimes.com"], category: "Games", description: "Guess the five-letter word in six tries." },
  { id: "duolingo", name: "Duolingo", publisher: "Duolingo", url: "https://www.duolingo.com/", hosts: ["duolingo.com"], category: "Learning", description: "Learn a language with bite-sized lessons." },
  { id: "khan", name: "Khan Academy", publisher: "Khan Academy", url: "https://www.khanacademy.org/", hosts: ["khanacademy.org"], category: "Learning", description: "Free courses in maths, science and more." },
  { id: "desmos", name: "Desmos Calculator", publisher: "Desmos Studio", url: "https://www.desmos.com/calculator", hosts: ["desmos.com"], category: "Learning", description: "Graphing calculator for plotting functions." },
  { id: "wikipedia", name: "Wikipedia", publisher: "Wikimedia Foundation", url: "https://www.wikipedia.org/", hosts: ["wikipedia.org", "wikimedia.org"], category: "Learning", description: "The free encyclopedia." },
  { id: "translate", name: "Google Translate", publisher: "Google", url: "https://translate.google.com/", hosts: ["translate.google.com"], category: "Tools", description: "Translate text between 100+ languages." },
  { id: "squoosh", name: "Squoosh", publisher: "Google Chrome Labs", url: "https://squoosh.app/", hosts: ["squoosh.app"], category: "Tools", description: "Shrink and convert images in the browser." },
  { id: "claude", name: "Claude", publisher: "Anthropic", url: "https://claude.ai/", hosts: ["claude.ai"], category: "Tools", description: "Chat with Claude in its own window." },
];

/** Sign-in and consent pages that apps may use; they stay in the app (pop-ups open as small login windows). */
export const AUTH_HOSTS = [
  "accounts.google.com", "consent.google.com", "consent.youtube.com",
  "login.microsoftonline.com", "login.live.com", "account.live.com", "login.microsoft.com",
  "appleid.apple.com", "github.com", "id.atlassian.com", "auth.atlassian.com", "www.facebook.com",
];

export const webAppPartition = (id: string) => `persist:webapp-${id}`;
export const webAppById = (id: string) => WEB_APPS.find((a) => a.id === id);

export function hostMatches(url: string, hosts: string[]) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}
