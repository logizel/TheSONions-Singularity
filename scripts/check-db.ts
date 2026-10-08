import { db } from "../db/client";
import { hospitals, medicines, stockBatches, dailyUsage, users } from "../db/schema";

async function main() {
  const h = await db.select().from(hospitals);
  const m = await db.select().from(medicines);
  const s = await db.select().from(stockBatches);
  const u = await db.select().from(dailyUsage);
  const us = await db.select().from(users);

  console.log("Hospitals:", h.length, h.map(x => x.name));
  console.log("Medicines:", m.length, m.map(x => x.name));
  console.log("Stock batches:", s.length);
  console.log("Daily usage rows:", u.length);
  console.log("Users:", us.length, us.map(x => x.role));
}

main();
