#!/usr/bin/env node
/**
 * Import a receipt CSV into Financensor.
 *
 * Usage:
 *   node scripts/import-bon.mjs <csv_file> --group <id> --trip <id> [--date YYYY-MM-DD] [--token <token>]
 *
 * Environment variable FINANCENSOR_TOKEN can be used instead of --token.
 * Pfandartikel rows are skipped automatically.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const API_BASE = "https://api.financensor.stammkneipe.dev/api/v1";

const ALL_MEMBERS = [
  "4d3df086-47fa-4050-8650-478beb26cb6e",
  "02352eea-ffa8-428c-9138-ae8b8bd30157",
  "f9ac57b9-0d6a-4745-9887-ffab402e3036",
  "f6cf54b0-f1da-42ba-b684-89705034af8c",
  "0c861abb-4693-408d-8e59-f44805de127f",
  "49876791-fbf3-4b69-9d52-be683e810299",
  "298c7502-e2b3-4b35-b3f4-1f94e69853df",
];

const CATEGORIES = {
  essen: "eb6dad89-ed97-4478-b5a9-af3396d3995c",
  snacks: "39f6b200-df0d-4722-83bc-f5016f606d26",
  alkfrei: "421498ec-1b95-457e-b6b4-eafa4fb2a6ca",
  alkohol: "37ef8451-9922-49fe-bc12-13cba3175a77",
  haushalt: "e1daa674-69fc-48fc-9ce3-e4bbdfe69070",
};

const SNACKS_KW = [
  "chips", "zwiebelringe", "pizza rings", "butterkeks", "erdnussrie",
  "knoppers", "nimm2", "milka", "joghurt", "drachenzungen", "drachenz.",
];

const ALKFREI_KW = [
  "mineralwasser", "coca-cola", "cola zero", "afri cola", "dr.pepper",
  "fanta", "dreh trink", "lübzer lümo", "paulaner cola", "paulaner spezi",
  "powerade", "monster", "crazy wolf", "zitronenteegetr",
];

const ALKOHOL_KW = [
  "desperados", "sexonthebeach", "pinot noir", "bembel", "augustiner",
  "suntory",
];

const HAUSHALT_KW = [
  "alu grillschal", "alufolie", "hoko", "softgripschere",
];

function classify(name) {
  const lower = name.toLowerCase();
  if (SNACKS_KW.some((kw) => lower.includes(kw))) return CATEGORIES.snacks;
  if (ALKFREI_KW.some((kw) => lower.includes(kw))) return CATEGORIES.alkfrei;
  if (ALKOHOL_KW.some((kw) => lower.includes(kw))) return CATEGORIES.alkohol;
  if (HAUSHALT_KW.some((kw) => lower.includes(kw))) return CATEGORIES.haushalt;
  return CATEGORIES.essen;
}

function parseCsv(content) {
  const lines = content.trim().split("\n");
  const header = lines[0].split(";").map((h) => h.trim());
  const artikelIdx = header.indexOf("Artikel");
  const gesamtIdx = header.indexOf("Gesamt_EUR");

  if (artikelIdx === -1 || gesamtIdx === -1) {
    throw new Error("CSV must have 'Artikel' and 'Gesamt_EUR' columns");
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim());
    const name = cols[artikelIdx];
    if (!name || name === "Pfandartikel") continue;

    const totalStr = cols[gesamtIdx].replace(",", ".");
    const amountCents = Math.round(parseFloat(totalStr) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) continue;

    items.push({ description: name, amountCents });
  }
  return items;
}

async function getMe(token) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /users/me failed: ${res.status}`);
  return res.json();
}

async function sendBulk(groupId, purchases, token) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/purchases/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(purchases),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST bulk failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      group: { type: "string" },
      trip: { type: "string" },
      date: { type: "string" },
      token: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log("Usage: node scripts/import-bon.mjs <csv> --group <id> --trip <id> [--date YYYY-MM-DD] [--token <t>]");
    process.exit(0);
  }

  const csvPath = positionals[0];
  const groupId = values.group;
  const tripId = values.trip;
  const token = values.token || process.env.FINANCENSOR_TOKEN;
  const date = values.date || new Date().toISOString().slice(0, 10);

  if (!groupId || !tripId) {
    console.error("Error: --group and --trip are required");
    process.exit(1);
  }
  if (!token) {
    console.error("Error: provide --token or set FINANCENSOR_TOKEN");
    process.exit(1);
  }

  const me = await getMe(token);
  console.log(`Paying user: ${me.name} (${me.id})`);

  const content = readFileSync(csvPath, "utf-8");
  const items = parseCsv(content);

  const purchases = items.map((item) => ({
    description: item.description,
    amountCents: item.amountCents,
    paidByUserId: me.id,
    categoryId: classify(item.description),
    tripId,
    purchasedAt: date,
    assignedTo: ALL_MEMBERS,
  }));

  const totalCents = purchases.reduce((sum, p) => sum + p.amountCents, 0);
  console.log(`Parsed ${purchases.length} items, total: ${(totalCents / 100).toFixed(2)} EUR (excl. Pfand)`);

  if (purchases.length === 0) {
    console.log("No items to import.");
    process.exit(0);
  }

  const result = await sendBulk(groupId, purchases, token);
  console.log(`Created ${result.count} purchases successfully.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
