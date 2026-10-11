export const BUCKETS = [
  { id: "lt20", kind: "ugc", n: 1, label: "< 20k followers", short: "< 20k", colon: ":" },
  { id: "band20", kind: "ugc", n: 2, label: "20\u201350k Followers", short: "20\u201350k", colon: ":" },
  { id: "band50", kind: "ugc", n: 3, label: "50\u2013100k Followers", short: "50\u2013100k", colon: ":" },
  { id: "band100", kind: "ugc", n: 4, label: "100\u2013200k Followers", short: "100\u2013200k", colon: ":" },
  { id: "band200", kind: "ugc", n: 5, label: "200-500K+ Followers", short: "200-500k", colon: ":" },
  { id: "band500", kind: "ugc", n: 6, label: "500K+ Followers", short: "500k+", colon: ":" },
  { id: "premium", kind: "solo", n: 0, label: "Insta Meme Premium", short: "Meme Premium", colon: " :" },
  { id: "meme", kind: "solo", n: 0, label: "Insta Meme", short: "Meme", colon: ":" },
  { id: "political", kind: "solo", n: 0, label: "Insta Political", short: "Political", colon: ":" },
] as const;

export type BucketId = (typeof BUCKETS)[number]["id"];

export type Report = {
  id: string;
  campaign: string;
  date: string;
  buckets: Record<BucketId, string[]>;
  updatedAt: number;
};

export type Block =
  | { type: "title" | "campaign" | "intro" | "group" | "section"; text: string }
  | { type: "gap" }
  | { type: "table"; rows: { n: number; url: string }[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function emptyBuckets(): Record<BucketId, string[]> {
  return {
    lt20: [],
    band20: [],
    band50: [],
    band100: [],
    band200: [],
    band500: [],
    premium: [],
    meme: [],
    political: [],
  };
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function createId(): string {
  return crypto.randomUUID();
}

export function emptyReport(): Report {
  return {
    id: "draft",
    campaign: "",
    date: "",
    buckets: emptyBuckets(),
    updatedAt: 0,
  };
}

export function freshReport(): Report {
  const date = todayISO();
  return applyDateLinks(
    {
      id: createId(),
      campaign: "",
      date,
      buckets: emptyBuckets(),
      updatedAt: Date.now(),
    },
    date,
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${ordinal(d)} ${MONTHS[m - 1]} ${y}`;
}

export function bucketHeading(id: BucketId, count: number): string {
  const def = BUCKETS.find((b) => b.id === id);
  if (!def) return String(count);
  if (def.kind === "ugc") return `${def.n}. ${def.label}: ${count}`;
  return `${def.label}${def.colon} ${count}`;
}

export function campaignLine(report: Report): string {
  const name = report.campaign.trim();
  const date = report.date ? formatLongDate(report.date) : "";
  if (name && date) return `${name} [${date}]`;
  if (date) return `[${date}]`;
  if (name) return name;
  return "Campaign [date]";
}

export function linkTotal(report: Report): number {
  return BUCKETS.reduce((sum, def) => sum + report.buckets[def.id].length, 0);
}

export function groupTotals(report: Report) {
  const ugc = (["lt20", "band20", "band50", "band100", "band200", "band500"] as const).reduce(
    (sum, id) => sum + report.buckets[id].length,
    0,
  );
  return {
    total: linkTotal(report),
    ugc,
    premium: report.buckets.premium.length,
    meme: report.buckets.meme.length,
    political: report.buckets.political.length,
  };
}

export function buildBlocks(report: Report): Block[] {
  const blocks: Block[] = [
    { type: "title", text: "Instagram Work Report" },
    { type: "campaign", text: campaignLine(report) },
    { type: "intro", text: "Today\u2019s completed links:" },
    { type: "gap" },
    { type: "group", text: "UGC Videos" },
  ];

  for (const def of BUCKETS) {
    if (!(def.kind === "ugc" && def.n === 1)) blocks.push({ type: "gap" });
    const links = report.buckets[def.id];
    blocks.push({ type: "section", text: bucketHeading(def.id, links.length) });
    if (links.length > 0) {
      blocks.push({
        type: "table",
        rows: links.map((url, i) => ({ n: i + 1, url })),
      });
    }
  }

  return blocks;
}

export function toPlain(report: Report): string {
  const lines: string[] = [];
  for (const block of buildBlocks(report)) {
    if (block.type === "gap") lines.push("");
    else if (block.type === "table") {
      lines.push("Sr no\tLink");
      for (const row of block.rows) lines.push(`${row.n}\t${row.url}`);
    } else lines.push(block.text);
  }
  return `${lines.join("\n").trim()}\n`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function toHtml(report: Report): string {
  const parts: string[] = [];
  for (const block of buildBlocks(report)) {
    if (block.type === "title") {
      parts.push(`<p style="font-size:20px;font-weight:700;margin:0 0 8px">${esc(block.text)}</p>`);
    } else if (block.type === "campaign") {
      parts.push(`<p style="font-size:16px;font-weight:700;margin:0 0 8px">${esc(block.text)}</p>`);
    } else if (block.type === "intro") {
      parts.push(`<p style="margin:0 0 12px">${esc(block.text)}</p>`);
    } else if (block.type === "group") {
      parts.push(`<p style="font-size:16px;font-weight:700;margin:16px 0 8px">${esc(block.text)}</p>`);
    } else if (block.type === "section") {
      parts.push(`<p style="font-weight:700;margin:12px 0 6px">${esc(block.text)}</p>`);
    } else if (block.type === "gap") {
      parts.push('<p style="margin:0;line-height:8px">&nbsp;</p>');
    } else if (block.type === "table") {
      const rows = block.rows
        .map(
          (row) =>
            `<tr><td style="border:1px solid #cccccc;padding:4px 8px;width:72px">${row.n}</td><td style="border:1px solid #cccccc;padding:4px 8px"><a href="${esc(row.url)}">${esc(row.url)}</a></td></tr>`,
        )
        .join("");
      parts.push(
        `<table style="border-collapse:collapse;width:100%;margin:0 0 8px"><thead><tr><td style="border:1px solid #cccccc;padding:4px 8px;font-weight:700;width:72px">Sr no</td><td style="border:1px solid #cccccc;padding:4px 8px;font-weight:700">Link</td></tr></thead><tbody>${rows}</tbody></table>`,
      );
    }
  }
  return `<div style="font-family:Arial,sans-serif;color:#111111">${parts.join("")}</div>`;
}

export function toDocHtml(report: Report): string {
  const title = esc(`Instagram Work Report — ${campaignLine(report)}`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${toHtml(report)}</body></html>`;
}

export function fileSlug(report: Report): string {
  const name = (report.campaign.trim() || "report").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return `Instagram-Work-Report-${name || "report"}-${report.date || "date"}`;
}

export function extractUrls(raw: string): string[] {
  const found: string[] = [];
  const re = /https?:\/\/[^\s<>"']+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) found.push(cleanUrl(match[0]));

  if (found.length === 0) {
    for (const line of raw.split(/\n+/)) {
      let text = line.trim().replace(/^\d+[\).\s:-]+/, "").trim();
      if (!text) continue;
      if (/instagram\.com|instagr\.am/i.test(text)) {
        if (!/^https?:/i.test(text)) text = `https://${text.replace(/^\/\//, "")}`;
        found.push(cleanUrl(text));
      }
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of found) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function cleanUrl(url: string): string {
  return url.replace(/[),.;]+$/g, "");
}

export function shortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function duplicateCodes(report: Report): Set<string> {
  const counts = new Map<string, number>();
  for (const def of BUCKETS) {
    for (const url of report.buckets[def.id]) {
      const code = shortcode(url);
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  const dupes = new Set<string>();
  for (const [code, count] of counts) {
    if (count > 1) dupes.add(code);
  }
  return dupes;
}

const ROSTER: { followers: number; byDate: Record<string, string> }[] = [
  { followers: 17800, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeW5dGBJ2Bz/?dlrf=MXNtNTUzdGQ4NzhjYQ==" } },
  { followers: 15000, byDate: { "2026-10-10": "https://www.instagram.com/reel/DeUsslVS7sc/?psln=MXQ3cnY1ZDkweXZ2" } },
  { followers: 14400, byDate: { "2026-10-10": "https://www.instagram.com/reel/DeUuYxkSFt3/?psln=MWwzMTg1bzV6MTQ2aQ==" } },
  {
    followers: 40600,
    byDate: {
      "2026-10-10": "https://www.instagram.com/reel/DeUv4-fSzqW/?psln=MTN0cnFmZWFiMmNoMQ==",
      "2026-10-11": "https://www.instagram.com/reel/DeW0WboyYt_/?dlrf=amxweDh3dDVoYWw4",
    },
  },
  { followers: 61300, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeW0WJav5Ir/?vrfl=MW4zdmZiYm5vdmpoNw==" } },
  { followers: 26800, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeW72cKyw1u/?" } },
  { followers: 109000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeWu2iVv6Bu/?cplk=cnhsOXo2cHFsc3Bs" } },
  { followers: 289000, byDate: { "2026-10-10": "https://www.instagram.com/reel/DeUTNHGvLwF/?obrf=YzZrdjE3aGd2emI4" } },
  { followers: 227000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeWm8THOwAV/?srtk=d3lldmlqN2Q1cmRi" } },
  { followers: 525000, byDate: { "2026-10-10": "https://www.instagram.com/reel/DeUcevuIXcR/?dlrf=MWVjb3d2ZnMzeWY2aw==" } },
  { followers: 2200000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeWwnO2Te9O/?cplk=MTVnZ3YxeWhmczc3dA==" } },
  { followers: 1600000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeWYWmWyrEi/?utm_source=ig_web_copy_link&psln=NTc4MTIwNjQ2YQ==" } },
  { followers: 421000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeWfohHJlCw/?utm_source=ig_web_copy_link&cplk=NTc4MTIwNjQ2YQ==" } },
  { followers: 131000, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeXCyomtou-/?utm_source=ig_web_copy_link&exln=NTc4MTIwNjQ2YQ==" } },
  { followers: 43400, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeW_wjZKNK3/?utm_source=ig_web_copy_link&srtk=NTc4MTIwNjQ2YQ==" } },
  { followers: 32100, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeXF7ISSgkJ/?" } },
  { followers: 30200, byDate: { "2026-10-11": "https://www.instagram.com/reel/DeXKCu1TG_H/?dlrf=MTk4Y2c0bW41ZnR5OQ==" } },
];

function bucketForFollowers(followers: number): "lt20" | "band20" | "band50" | "band100" | "band200" | "band500" {
  if (followers < 20000) return "lt20";
  if (followers < 50000) return "band20";
  if (followers < 100000) return "band50";
  if (followers < 200000) return "band100";
  if (followers < 500000) return "band200";
  return "band500";
}

export function ugcLinksForDate(iso: string): Pick<Record<BucketId, string[]>, "lt20" | "band20" | "band50" | "band100" | "band200" | "band500"> {
  const buckets = {
    lt20: [] as string[],
    band20: [] as string[],
    band50: [] as string[],
    band100: [] as string[],
    band200: [] as string[],
    band500: [] as string[],
  };
  for (const row of ROSTER) {
    const url = row.byDate[iso];
    if (!url) continue;
    buckets[bucketForFollowers(row.followers)].push(url);
  }
  return buckets;
}

const SOLO_BY_DATE: Record<string, { premium: string[]; meme: string[]; political: string[] }> = {
  "2026-10-10": {
    premium: [
      "https://www.instagram.com/reel/DeT-lI-teJb/?rpxt=d2FkYWQ4ZWNlaXRy",
      "https://www.instagram.com/reel/DeUBnJ-tlQq/?dlrf=MWM0enB0ZHo5NmNrMQ==",
      "https://www.instagram.com/reel/DeT-9NYAdLZ/?dlrf=c2l5ODR5ZzF2aHZ0"
    ],
    meme: [
      "https://www.instagram.com/reel/DeUN9Q8JFFU/",
      "https://www.instagram.com/reel/DeUOZT6ByG6/",
      "https://www.instagram.com/reel/DeUOLOhBEts/",
      "https://www.instagram.com/reel/DeUO6jeSZmU/",
      "https://www.instagram.com/reel/DeUOo1bTxLy/",
      "https://www.instagram.com/reel/DeTlCKcTwIk/",
      "https://www.instagram.com/reel/DeTlVo9PaeT/",
      "https://www.instagram.com/reel/DeTlrh_NDzn/",
      "https://www.instagram.com/reel/DeUoSfbIFhh/",
      "https://www.instagram.com/reel/DeUZqjPpZlV/",
      "https://www.instagram.com/reel/DeUmH-dPtQV/",
      "https://www.instagram.com/reel/DeUmCdbzudX/",
      "https://www.instagram.com/reel/DeUnUpmsx2P/",
      "https://www.instagram.com/reel/DeUZrqxPiu8/",
      "https://www.instagram.com/reel/DeUaPNSI2ds/",
      "https://www.instagram.com/reel/DeUYAscT_Nm/",
      "https://www.instagram.com/reel/DeUYJMtTGKV/",
      "https://www.instagram.com/reel/DeUZdBbS_b7/",
      "https://www.instagram.com/reel/DeUZMBnAIRr/",
      "https://www.instagram.com/reel/DeUaeYXITg_/",
      "https://www.instagram.com/reel/DeUai0QM7N0/",
      "https://www.instagram.com/reel/DeUaseXtsTi/",
      "https://www.instagram.com/reel/DeUcL03hbuW/",
      "https://www.instagram.com/reel/DeUaxChSOoP/",
      "https://www.instagram.com/reel/DeUXGkBtnhn/",
      "https://www.instagram.com/reel/DeUXopKswJ6/",
      "https://www.instagram.com/reel/DeUYrBTyfnP/",
      "https://www.instagram.com/reel/DeUXwNPTZ3Z/",
      "https://www.instagram.com/reel/DeUYZb_SwgH/",
      "https://www.instagram.com/reel/DeUZMGRi9qU/",
      "https://www.instagram.com/reel/DeUZXnSy3s7/",
      "https://www.instagram.com/reel/DeUa25dJnPu/",
      "https://www.instagram.com/reel/DeUbdgyJH_Q/",
      "https://www.instagram.com/reel/DeUbJ-9Tujh/",
      "https://www.instagram.com/reel/DeUc3eShfCY/",
      "https://www.instagram.com/reel/DeUcrUFMUMd/",
      "https://www.instagram.com/reel/DeUdG6fzjiY/",
      "https://www.instagram.com/reel/DeUdGHZpuoI/",
      "https://www.instagram.com/reel/DeUdOdnzLTn/",
      "https://www.instagram.com/reel/DeUdixdp_2g/"
    ],
    political: [],
  },
  "2026-10-11": {
    premium: [
      "https://www.instagram.com/reel/DeWP88jveY1/?rpxt=dmllNm5mYTl1aGFq",
      "https://www.instagram.com/reel/DeW7T3ppHnP/?exln=MWxuazc0NmJweHE5eg==",
      "https://www.instagram.com/reel/DeW81m0TI2TS1sov8uKXluWGuPeZlBi46tBNgc0/?dlrf=dng2ODF0bWxrMjk="
    ],
    meme: [
      "https://www.instagram.com/p/DeW1ETcJVgL/?obrf=MTFpNnBpeHJsbmJucQ==",
      "https://www.instagram.com/p/DeW07yMhzhx/?psln=MWN0a3JqdmZ3dG55MA==",
      "https://www.instagram.com/p/DeW0zhOhA_T/?srtk=MTd0OXM1bG12dWpoYg==",
      "https://www.instagram.com/p/DeW1JWJy5a7/?vrfl=b2M0cHloOHl1MzB6",
      "https://www.instagram.com/p/DeW1Q5GTotG/?exln=cm5pM3dtcGRhcnFm",
      "https://www.instagram.com/reel/DeWH-mxTlnH/?dlrf=MXBvdmZtZHBuYnRldQ==",
      "https://www.instagram.com/reel/DeWINOQvDgV/?obrf=MWlvOTRrcWtscWxncQ==",
      "https://www.instagram.com/reel/DeWIcZbtp2W/?cplk=ZG5vNXVnZDB5cjh6",
      "https://www.instagram.com/reel/DeWNJCAoGni/?rpxt=Yng3NHZzcWhjeWV2",
      "https://www.instagram.com/reel/DeWIi7Mpa9H/?vrfl=MXN4eDJpOWo0YWd0ag==",
      "https://www.instagram.com/reel/DeWKPg9vKHQ/?vrfl=aG4ybTF1NHRleDA0",
      "https://www.instagram.com/reel/DeWKSWtz6sO/?obrf=MXZmNzV3ZTlpZTh2aQ==",
      "https://www.instagram.com/reel/DeWITlExYVo/?rpxt=MW5yYTM0ZHAzdzV6ZQ==",
      "https://www.instagram.com/reel/DeWLKfMhsD8/?psln=MTc0Ync0NjQ0YTh1bQ==",
      "https://www.instagram.com/reel/DeWJP4gIY_I/?obrf=MW1meHhycGdibHhraQ==",
      "https://www.instagram.com/p/DeW0_n_TtLb/?mdxt=dWFmb2JmM3kxdGhw",
      "https://www.instagram.com/p/DeW1aK0z-4i/?dlrf=ZW1zYmx1b2Nlc2tm",
      "https://www.instagram.com/p/DeW1sa0ycJH/?cplk=MXh2bmUzZXN2OTF5cg==",
      "https://www.instagram.com/p/DeW1e7DA0zI/?mdxt=MW8zZG9manpueW1zag==",
      "https://www.instagram.com/p/DeWQO2_oO2F/?xtok=MTN2MTJ2YTV3Ymo2bg==",
      "https://www.instagram.com/p/DeWKgxUsbFE/?dlrf=MTBlODhqMjI0aHR1Mg==",
      "https://www.instagram.com/p/DeWQUoMNvrZ/?dlrf=amJoazE2MmZ0NWg=",
      "https://www.instagram.com/p/DeWMCrjBnzK/?psln=MXJkc2RtNzllbG41Yg==",
      "https://www.instagram.com/reel/DeW13G8yihb/?obrf=MTE3MG8zZDRvNXo3Ng==",
      "https://www.instagram.com/p/DeWVixPtdBm/?xtok=MWs2eXhzZGIyN3Jldg==",
      "https://www.instagram.com/p/DeW3tgSs-3t/?exln=MW5ocmswcTluMzQ2dA==",
      "https://www.instagram.com/reel/DeW4D9dyBm4/?psln=YnE0c3RkZmwwcDVk",
      "https://www.instagram.com/reel/DeW4vPRzqz1/?vrfl=MWl5MTYzcHp2ZTNlaw==",
      "https://www.instagram.com/p/DeW4frEi9uD/?mdxt=MXdoZmV2MGNrNXR3Mw==",
      "https://www.instagram.com/reel/DeW5PwTiNoQ/?rpxt=MWtkbTVhcHh6NmQ2aQ==",
      "https://www.instagram.com/reel/DeW5gkQSfsU/?exln=NDc0a2h5a2N0N3I4",
      "https://www.instagram.com/p/DeW5XMIT-Aa/?cplk=c2E5eW85NmZleTBs",
      "https://www.instagram.com/p/DeW5dXBTBoQ/?obrf=MWdpeXM0ZTNtcGp5aQ==",
      "https://www.instagram.com/p/DeW5lZMB8Qi/?obrf=cW8zcXc0d25yd3R1",
      "https://www.instagram.com/p/DeW5zzZivVf/?rpxt=dTcybnFydnN5czNv",
      "https://www.instagram.com/p/DeW6XZMsRCI/?obrf=eDg3dGEyeDZxN2Vn",
      "https://www.instagram.com/reel/DeW6fe0zus3/?srtk=MXdzcXI3N21ib3VzOA==",
      "https://www.instagram.com/reel/DeW6oDlpGLo/?vrfl=eGlrczh4ajh0amUy",
      "https://www.instagram.com/reel/DeW6ygFzBF8/?psln=M2U5OG50MDd3djl4",
      "https://www.instagram.com/p/DeW6983hR3t/?xtok=MW04OGE3dHAwZmtxdw=="
    ],
    political: [
      "https://www.instagram.com/reel/DeWIoeHhcls/",
      "https://www.instagram.com/reel/DeWH_ohzMjk/",
      "https://www.instagram.com/reel/DeWIt4IxPPB/",
      "https://www.instagram.com/reel/DeWIXW1ukHk/",
      "https://www.instagram.com/reel/DeWIIf-ILbR/",
      "https://www.instagram.com/reel/DeWIkI3zkcl/",
      "https://www.instagram.com/reel/DeWIyhDyPUP/",
      "https://www.instagram.com/reel/DeWIPYpIebh/",
      "https://www.instagram.com/reel/DeWVydThmnd/",
      "https://www.instagram.com/reel/DeWIbuUzvdh/",
      "https://www.instagram.com/reel/DeW4_vpImsK/?srtk=MXFzand0b3UxeGR4Yw==",
      "https://www.instagram.com/reel/DeXAHmHyk0d/",
      "https://www.instagram.com/reel/DeXAiR3S6wt/",
      "https://www.instagram.com/reel/DeW5WLCSS6A/?dlrf=MXA0b2FrN2p2dXliaA==",
      "https://www.instagram.com/p/DeW71TgBu58/?xtok=bm1ndjZ5ZW1iang0",
      "https://www.instagram.com/reel/DeW4IA1h639/?psln=MTNjZWwxdm05NXF4",
      "https://www.instagram.com/p/DeW4xy2Em1K/?exln=ZWNmNmpnbnc0ZnUy",
      "https://www.instagram.com/p/DeXA5YYqRtU/?psln=bWlxYjB5d3I0N3Yw",
      "https://www.instagram.com/p/DeW6Q8tTHyx/?obrf=MTgyeGNka2F0N2lobw==",
      "https://www.instagram.com/p/DeW6PPfT2eb/?mdxt=MWNqb3YzdDBxbHcybg==",
      "https://www.instagram.com/p/DeW6ZRTTJiq/?dlrf=N3JyZmJvOTJnODYw",
      "https://www.instagram.com/p/DeW9YM6TNdG/?srtk=NHdwcWloN3NiYWx2",
      "https://www.instagram.com/p/DeW6huyjG1f/?dlrf=MWtqM3Y2Ymo0N2UxNw==",
      "https://www.instagram.com/reel/DeW3FeMo6bi/?exln=b3VjdGh6YjNsMTdi",
      "https://www.instagram.com/reel/DeW0OMVuQ7d/?vrfl=M3Ntdm9lcTIxbXc5",
      "https://www.instagram.com/reel/DeXErRLO9zn/?obrf=cm9yNmF2MjFnZjJq",
      "https://www.instagram.com/p/DeWIqCNR6B0/?srtk=MWYxcTkwMmhveTR0bw==",
      "https://www.instagram.com/p/DeWI_VLyZ30/",
      "https://www.instagram.com/p/DeWIyaZCmY3/",
      "https://www.instagram.com/reel/DeW7n6Cy-KP/?obrf=MXd3ZXZqdnB0dnl1",
      "https://www.instagram.com/reel/DeW4-12o7zu/?psln=MTI4d3g4d3ZsMTF3eA==",
      "https://www.instagram.com/reel/DeW5_dhyoWh/?psln=MWpwdngwb3BrMDE0bg==",
      "https://www.instagram.com/p/DeWJ0fWJ-Zi/",
      "https://www.instagram.com/reel/DeW58AFPWtu/?exln=MXZsdWp3cmdnbDJoeg==",
      "https://www.instagram.com/p/DeWJ5dGhPtH/",
      "https://www.instagram.com/reel/DeW6DMoITEn/?rpxt=MXcwcms0M3hwaHJwZw==",
      "https://www.instagram.com/reel/DeW9T16pNIl/?vrfl=azg3bXQxNW0weTQ2",
      "https://www.instagram.com/reel/DeW__yGBSff/?obrf=Y2VqcWwwM29sOWhx",
      "https://www.instagram.com/reel/DeW7Wbts_Jd/?exln=dnoxZG43a282a21v",
      "https://www.instagram.com/reel/DeW7Mf1M-bU/?psln=Y3N1bGxjNmVnanlj"
    ],
  }
};

export function applyDateLinks(report: Report, iso: string): Report {
  const solo = SOLO_BY_DATE[iso] ?? { premium: [], meme: [], political: [] };
  return {
    ...report,
    date: iso,
    buckets: {
      ...report.buckets,
      ...ugcLinksForDate(iso),
      premium: [...solo.premium],
      meme: [...solo.meme],
      political: [...solo.political],
    },
    updatedAt: Date.now(),
  };
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com|instagr\.am/i.test(url);
}

const SAMPLE_BUCKETS: Record<BucketId, string[]> = {
  lt20: [],
  band20: [],
  band50: [],
  band100: ["https://www.instagram.com/reel/DeWu2iVv6Bu/?cplk=cnhsOXo2cHFsc3Bs"],
  band200: [
    "https://www.instagram.com/reel/DeWfohHJlCw/?psln=MXBsN24xaDRhZW1zNQ==",
    "https://www.instagram.com/reel/DeWm8THOwAV/?srtk=d3lldmlqN2Q1cmRi",
  ],
  band500: ["https://www.instagram.com/reel/DeWYWmWyrEi/?exln=eW1rdTd5cHpuaWJ0"],
  premium: ["https://www.instagram.com/reel/DeWP88jveY1/?exln=dmllNm5mYTl1aGFq"],
  meme: [
    "https://www.instagram.com/reel/DeWH-mxTlnH/?dlrf=MXBvdmZtZHBuYnRldQ==",
    "https://www.instagram.com/reel/DeWINOQvDgV/?obrf=MWlvOTRrcWtscWxncQ==",
    "https://www.instagram.com/reel/DeWIcZbtp2W/?cplk=ZG5vNXVnZDB5cjh6",
    "https://www.instagram.com/reel/DeWNJCAoGni/?rpxt=Yng3NHZzcWhjeWV2",
    "https://www.instagram.com/reel/DeWIi7Mpa9H/?vrfl=MXN4eDJpOWo0YWd0ag==",
    "https://www.instagram.com/reel/DeWKPg9vKHQ/?vrfl=aG4ybTF1NHRleDA0",
    "https://www.instagram.com/reel/DeWKSWtz6sO/?obrf=MXZmNzV3ZTlpZTh2aQ==",
    "https://www.instagram.com/reel/DeWITlExYVo/?rpxt=MW5yYTM0ZHAzdzV6ZQ==",
    "https://www.instagram.com/reel/DeWLKfMhsD8/?psln=MTc0Ync0NjQ0YTh1bQ==",
    "https://www.instagram.com/reel/DeWJP4gIY_I/?obrf=MW1meHhycGdibHhraQ==",
    "https://www.instagram.com/p/DeWQO2_oO2F/?xtok=MTN2MTJ2YTV3Ymo2bg==",
    "https://www.instagram.com/p/DeWKgxUsbFE/?dlrf=MTBlODhqMjI0aHR1Mg==",
    "https://www.instagram.com/p/DeWQUoMNvrZ/?dlrf=amJoazE2MmZ0NWg=",
    "https://www.instagram.com/p/DeWMCrjBnzK/?psln=MXJkc2RtNzllbG41Yg==",
    "https://www.instagram.com/p/DeWVixPtdBm/?xtok=MWs2eXhzZGIyN3Jldg==",
  ],
  political: [
    "https://www.instagram.com/reel/DeWIoeHhcls/",
    "https://www.instagram.com/reel/DeWH_ohzMjk/",
    "https://www.instagram.com/reel/DeWIt4IxPPB/",
    "https://www.instagram.com/reel/DeWIXW1ukHk/",
    "https://www.instagram.com/reel/DeWIIf-ILbR/",
    "https://www.instagram.com/reel/DeWIkI3zkcl/",
    "https://www.instagram.com/reel/DeWIyhDyPUP/",
    "https://www.instagram.com/reel/DeWIPYpIebh/",
    "https://www.instagram.com/reel/DeWVydThmnd/",
    "https://www.instagram.com/reel/DeWIbuUzvdh/",
    "https://www.instagram.com/p/DeWIqCNR6B0/?srtk=MWYxcTkwMmhveTR0bw==",
    "https://www.instagram.com/p/DeWI_VLyZ30/",
    "https://www.instagram.com/p/DeWIyaZCmY3/",
    "https://www.instagram.com/p/DeWJ0fWJ-Zi/",
    "https://www.instagram.com/p/DeWJ5dGhPtH/",
  ],
};

export function sampleReport(): Report {
  return {
    id: createId(),
    campaign: "CJP Protest",
    date: "2026-10-11",
    buckets: {
      lt20: [...SAMPLE_BUCKETS.lt20],
      band20: [...SAMPLE_BUCKETS.band20],
      band50: [...SAMPLE_BUCKETS.band50],
      band100: [...SAMPLE_BUCKETS.band100],
      band200: [...SAMPLE_BUCKETS.band200],
      band500: [...SAMPLE_BUCKETS.band500],
      premium: [...SAMPLE_BUCKETS.premium],
      meme: [...SAMPLE_BUCKETS.meme],
      political: [...SAMPLE_BUCKETS.political],
    },
    updatedAt: Date.now(),
  };
}
