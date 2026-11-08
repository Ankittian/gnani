/** Deterministic synthetic demo shop. No real people, phone numbers or IDs (hackathon rule). */
import type { LangCode } from "@/lib/i18n/languages";
import { DEFAULT_VOICE } from "@/lib/i18n/languages";
import type { Customer, LedgerEntry, LineItem, Order, Product, Sale, Shop, Supplier, Unit } from "@/lib/types";
import type { DukaanDB } from "./schema";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS: [string, string, LangCode, string[]][] = [
  ["cust-ramesh", "Ramesh Sharma", "hi-IN", ["Sharma ji", "शर्मा जी", "रमेश शर्मा"]],
  ["cust-suresh", "Suresh Sharma", "hi-IN", ["सुरेश शर्मा"]],
  ["cust-lakshmi", "Lakshmi Amma", "kn-IN", ["ಲಕ್ಷ್ಮಿ ಅಮ್ಮ", "Lakshmi"]],
  ["cust-murugan", "Murugan", "ta-IN", ["முருகன்"]],
  ["cust-patil", "Patil Saheb", "mr-IN", ["पाटील साहेब", "Patil"]],
  ["cust-fatima", "Fatima Begum", "hi-IN", ["फ़ातिमा बेगम", "Fatima"]],
  ["cust-joseph", "Joseph", "ml-IN", ["ജോസഫ്"]],
  ["cust-gurpreet", "Gurpreet Singh", "pa-IN", ["ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ", "Singh ji"]],
  ["cust-ramu", "Ramu Garu", "te-IN", ["రాము గారు", "Ramu"]],
  ["cust-das", "Das Babu", "bn-IN", ["দাস বাবু", "Das"]],
  ["cust-mehul", "Mehul Bhai", "gu-IN", ["મેહુલ ભાઈ", "Mehul"]],
  ["cust-anjali", "Anjali Didi", "hi-IN", ["अंजलि दीदी", "Anjali"]],
];

const SUPPLIERS: [string, string, LangCode][] = [
  ["sup-manjunath", "Manjunath Traders", "kn-IN"],
  ["sup-murugan", "Murugan Agencies", "ta-IN"],
  ["sup-agarwal", "Agarwal Distributors", "hi-IN"],
  ["sup-sai", "Sai Wholesale", "te-IN"],
];

// id, name, emoji, unit, price ₹, stock, reorderLevel, supplier, aliases
const PRODUCTS: [string, string, string, Unit, number, number, number, string, string[]][] = [
  ["prod-chawal", "Chawal (Sona Masoori)", "🍚", "kg", 60, 40, 10, "sup-manjunath", ["chawal", "rice", "चावल", "ಅಕ್ಕಿ"]],
  ["prod-atta", "Aashirvaad Atta", "🌾", "kg", 48, 6, 10, "sup-manjunath", ["atta", "आटा", "ಹಿಟ್ಟು"]],
  ["prod-toor", "Toor Dal", "🫘", "kg", 160, 8, 5, "sup-manjunath", ["toor dal", "arhar", "तूर दाल", "ತೊಗರಿ ಬೇಳೆ"]],
  ["prod-sugar", "Sugar", "🧂", "kg", 45, 3, 5, "sup-manjunath", ["sugar", "chini", "चीनी", "ಸಕ್ಕರೆ"]],
  ["prod-salt", "Tata Salt", "🧂", "packet", 28, 15, 5, "sup-agarwal", ["salt", "namak", "नमक", "ಉಪ್ಪು"]],
  ["prod-poha", "Poha", "🍛", "kg", 70, 4, 3, "sup-manjunath", ["poha", "पोहा", "ಅವಲಕ್ಕಿ"]],
  ["prod-besan", "Besan", "🟡", "kg", 110, 2, 3, "sup-manjunath", ["besan", "बेसन", "ಕಡಲೆ ಹಿಟ್ಟು"]],
  ["prod-rava", "Rava (Sooji)", "🥣", "kg", 55, 5, 3, "sup-manjunath", ["rava", "sooji", "सूजी", "ರವೆ"]],
  ["prod-maggi", "Maggi Noodles", "🍜", "packet", 14, 0, 12, "sup-murugan", ["maggi", "मैगी", "மேகி"]],
  ["prod-parleg", "Parle-G", "🍪", "packet", 10, 2, 10, "sup-murugan", ["parle g", "parle ji", "पारले जी", "பார்லே ஜி"]],
  ["prod-goodday", "Good Day Biscuit", "🍪", "packet", 30, 14, 6, "sup-murugan", ["good day", "गुड डे"]],
  ["prod-kurkure", "Kurkure", "🌶️", "packet", 20, 18, 8, "sup-murugan", ["kurkure", "कुरकुरे"]],
  ["prod-lays", "Lay's Chips", "🥔", "packet", 20, 5, 8, "sup-murugan", ["lays", "chips", "लेज़"]],
  ["prod-haldiram", "Haldiram Namkeen", "🥜", "packet", 55, 9, 4, "sup-murugan", ["haldiram", "namkeen", "नमकीन"]],
  ["prod-coke", "Coca-Cola 750ml", "🥤", "bottle", 40, 12, 6, "sup-murugan", ["coke", "coca cola", "कोक"]],
  ["prod-frooti", "Frooti", "🧃", "packet", 10, 30, 10, "sup-murugan", ["frooti", "फ्रूटी"]],
  ["prod-milk", "Amul Milk 500ml", "🥛", "packet", 30, 8, 10, "sup-sai", ["milk", "doodh", "दूध", "ಹಾಲು", "పాలు"]],
  ["prod-bread", "Bread", "🍞", "packet", 45, 6, 4, "sup-sai", ["bread", "ब्रेड", "pav"]],
  ["prod-eggs", "Eggs", "🥚", "dozen", 84, 3, 2, "sup-sai", ["eggs", "anda", "अंडा", "ಮೊಟ್ಟೆ"]],
  ["prod-fortune", "Fortune Sunflower Oil 1L", "🫙", "l", 155, 7, 4, "sup-sai", ["fortune oil", "tel", "तेल", "ಎಣ್ಣೆ"]],
  ["prod-groundnut", "Groundnut Oil 1L", "🥜", "l", 190, 1, 3, "sup-sai", ["groundnut oil", "moongfali tel", "मूंगफली तेल", "వేరుశెనగ నూనె"]],
  ["prod-redlabel", "Red Label Tea 250g", "🍵", "packet", 140, 10, 4, "sup-agarwal", ["chai patti", "tea", "चाय पत्ती", "ಟೀ ಪುಡಿ"]],
  ["prod-bru", "Bru Coffee", "☕", "packet", 95, 6, 3, "sup-agarwal", ["bru", "coffee", "कॉफ़ी", "ಕಾಫಿ"]],
  ["prod-colgate", "Colgate Toothpaste", "🪥", "piece", 58, 11, 4, "sup-agarwal", ["colgate", "toothpaste", "कोलगेट"]],
  ["prod-lifebuoy", "Lifebuoy Soap", "🧼", "piece", 35, 20, 6, "sup-agarwal", ["lifebuoy", "sabun", "साबुन"]],
  ["prod-surf", "Surf Excel 1kg", "🧺", "packet", 135, 4, 4, "sup-agarwal", ["surf", "surf excel", "सर्फ", "ಸರ್ಫ್"]],
  ["prod-vim", "Vim Bar", "🧽", "piece", 20, 16, 6, "sup-agarwal", ["vim", "विम"]],
  ["prod-dettol", "Dettol 250ml", "🧴", "bottle", 120, 5, 2, "sup-agarwal", ["dettol", "डेटॉल"]],
  ["prod-matchbox", "Matchbox", "🔥", "box", 2, 50, 20, "sup-agarwal", ["machis", "match box", "माचिस", "ಬೆಂಕಿ ಪೊಟ್ಟಣ"]],
  ["prod-agarbatti", "Agarbatti", "🪔", "packet", 25, 12, 5, "sup-agarwal", ["agarbatti", "अगरबत्ती", "ಊದಿನಕಡ್ಡಿ"]],
];

/** Clears shop data (keeps usage meter) and seeds a realistic 14-day history. */
export async function seedDemo(db: DukaanDB, shopLanguage: LangCode, now = new Date()): Promise<void> {
  const rand = mulberry32(20261108);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const nowIso = now.toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sinceMidnight = now.getTime() - startOfToday;
  let seq = 0;
  const id = (p: string) => `${p}-${(++seq).toString(36)}`;

  /** A timestamp `daysAgo` local days back; today's are always ≤ now. */
  const ts = (daysAgo: number): string => {
    if (daysAgo === 0) return new Date(now.getTime() - Math.floor(rand() * sinceMidnight * 0.9)).toISOString();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, int(8, 21), int(0, 59), int(0, 59));
    return d.toISOString();
  };

  const shop: Shop = {
    id: "shop",
    name: "Shree Ganesh Kirana",
    ownerName: "Ramesh",
    language: shopLanguage,
    assistantVoice: DEFAULT_VOICE,
    anyLanguage: false,
    cloneEmbedding: null,
    soundsOn: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const suppliers: Supplier[] = SUPPLIERS.map(([sid, name, language]) => ({ id: sid, name, language, createdAt: nowIso }));
  const products: Product[] = PRODUCTS.map(([pid, name, emoji, unit, price, stockQty, reorderLevel, supplierId, aliases]) => ({
    id: pid,
    name,
    aliases,
    unit,
    stockQty,
    reorderLevel,
    pricePaise: price * 100,
    supplierId,
    emoji,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  const balances = new Map<string, number>(CUSTOMERS.map(([cid]) => [cid, 0]));

  const lineItems = (n: number): LineItem[] => {
    const used = new Set<string>();
    return Array.from({ length: n }, () => {
      let p = pick(products);
      while (used.has(p.id)) p = pick(products); // distinct products per basket
      used.add(p.id);
      const qty = p.unit === "kg" ? int(1, 3) : int(1, 4);
      return { name: p.name, qty, unit: p.unit, productId: p.id, pricePaise: p.pricePaise };
    });
  };
  const itemsTotal = (items: LineItem[]) => items.reduce((a, it) => a + (it.pricePaise ?? 0) * (it.qty ?? 1), 0);

  const ledger: LedgerEntry[] = [];
  const sales: Sale[] = [];
  const orders: Order[] = [];
  const langOf = new Map(CUSTOMERS.map(([cid, , lang]) => [cid, lang]));

  for (let d = 13; d >= 0; d--) {
    for (let i = 0, n = int(3, 6); i < n; i++) {
      const items = lineItems(int(1, 3));
      sales.push({ id: id("sale"), items, amount: itemsTotal(items), transcript: "", createdAt: ts(d), deletedAt: null });
    }
    for (let i = 0, n = int(1, 3); i < n; i++) {
      const [cid] = pick(CUSTOMERS);
      const items = lineItems(int(1, 3));
      const amount = itemsTotal(items);
      ledger.push({ id: id("led"), customerId: cid, type: "credit", amount, items, transcript: "", language: langOf.get(cid)!, createdAt: ts(d), deletedAt: null });
      balances.set(cid, balances.get(cid)! + amount);
    }
    if (rand() < 0.6 || d === 0) {
      const owing = [...balances.entries()].filter(([, b]) => b > 10000);
      if (owing.length) {
        const [cid, bal] = pick(owing);
        const amount = Math.round((bal * (0.3 + rand() * 0.5)) / 1000) * 1000;
        ledger.push({ id: id("led"), customerId: cid, type: "payment", amount, items: [], transcript: "", language: langOf.get(cid)!, createdAt: ts(d), deletedAt: null });
        balances.set(cid, bal - amount);
      }
    }
  }

  const order = (status: Order["status"], daysAgo: number, cid: string | null, name: string | null, notes: string | null): Order => {
    const t = ts(daysAgo);
    const items = lineItems(int(2, 4)).map((it) => ({ ...it, packed: status !== "new" }));
    return { id: id("ord"), customerName: name, customerId: cid, items, notes, status, transcript: "", language: cid ? langOf.get(cid)! : shopLanguage, audioDurationSec: int(8, 40), createdAt: t, updatedAt: t };
  };
  orders.push(order("delivered", 6, "cust-joseph", "Joseph", null));
  orders.push(order("delivered", 3, "cust-fatima", "Fatima Begum", "Deliver after 6 pm"));
  orders.push(order("delivered", 0, "cust-mehul", "Mehul Bhai", null));
  orders.push(order("new", 0, "cust-lakshmi", "Lakshmi Amma", "Ghar pe bhej dena"));
  orders.push(order("new", 0, null, "Naya customer", null));

  const customers: Customer[] = CUSTOMERS.map(([cid, name, language, aliases]) => ({
    id: cid,
    name,
    nameAliases: aliases,
    language,
    balance: balances.get(cid)!,
    createdAt: nowIso,
    updatedAt: nowIso,
    deletedAt: null,
  }));

  const tables = [db.shop, db.customers, db.ledgerEntries, db.products, db.suppliers, db.stockEvents, db.sales, db.orders];
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await db.shop.put(shop);
    await db.suppliers.bulkAdd(suppliers);
    await db.products.bulkAdd(products);
    await db.customers.bulkAdd(customers);
    await db.ledgerEntries.bulkAdd(ledger);
    await db.sales.bulkAdd(sales);
    await db.orders.bulkAdd(orders);
  });
}
