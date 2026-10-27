import assert from "node:assert/strict";

const currencies = ["TRY", "USD", "EUR"];
const accountTypes = ["NAKİT", "BANKA", "ÇEK", "SENET", "KREDİ KARTI"];
const accountLabels = { TRY: "TL", USD: "Dolar", EUR: "Euro" };
const accounts = currencies.flatMap((currency) => accountTypes.map((type) => ({
  currency,
  type,
  name: `${accountLabels[currency]} ${type === "NAKİT" ? "Nakit Kasa" : type === "BANKA" ? "Banka Hesabı" : type}`,
})));
const taxonomy = {
  "FİTRE - FİDYE - YEMİN KEFARETİ": ["FİDYE", "FİTRE", "YEMİN KEFARETİ"],
  "GAZZE YARDIMLARI": ["AMELİYAT PROJESİ", "BEBEK MAMASI YARDIMI", "EĞİTİM ÇADIRI", "EKMEK DAĞITIMI", "GIDA KOLİSİ", "SEBZE KOLİSİ", "SU TANKERİ", "TOPLU YEMEK DAĞITIMI", "UN DAĞITIMI"],
  "GENEL BAĞIŞ": ["GENEL BAĞIŞ"],
  "GIDA KOLİSİ": ["GIDA KOLİSİ"],
  İFTAR: ["İFTAR"],
  KUMBARA: ["KUMBARA"],
  "KUR'AN-I KERİM": ["KUR'AN-I KERİM"],
  "TOPLU YEMEK": ["TOPLU YEMEK"],
  YETİM: ["YETİM"],
  "YETİM GİYİM": ["YETİM GİYİM"],
  "YURTİÇİ YARDIMLAR": ["AKÜLÜ TEKERLEKLİ SANDALYE", "FATURA DESTEĞİ", "GIDA KOLİSİ", "NAKDİ YARDIM", "YETİM", "ZİMEM DEFTERİ"],
  ZEKAT: ["ZEKAT"],
};
const planTypes = Object.keys(taxonomy);
const partners = ["CHASM-E-OMİD", "SENABİL", "GÜZEL ESER", "İNSAN DERNEĞİ", "KEDEV", "HAKİD", "MEWLANA", "DAMAL", "BERR GLOBAL"];
const date = (month, day) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const status = (amount, paid) => amount > 0 && paid >= amount ? "ÖDENDİ" : paid > 0 ? "KISMİ" : "ÖDENMEDİ";
const balances = new Map(accounts.map((account) => [account.name, 0]));
const operations = [];
const cashRows = [];
const plans = [];
let nextId = 9000000;

for (let index = 0; index < 300; index += 1) {
  const account = accounts[index % accounts.length];
  const amount = 10_000 + (index % 17) * 125;
  const row = {
    id: nextId++, kind: "cash-in", date: date(1 + (index % 10), 1 + (index % 28)), recordDate: date(1 + (index % 10), 1 + (index % 28)),
    movement: "GİRİŞ", movementType: index % 2 ? "SERMAYE" : "SERBEST BAĞIŞ", payment: account.type, account: account.name,
    amount, currency: account.currency, debtName: `Stres testi gelir ${index + 1}`, note: `300 kasa girişinden ${index + 1}`,
  };
  cashRows.push(row); operations.push(row); balances.set(account.name, balances.get(account.name) + amount);
}

for (let index = 0; index < 250; index += 1) {
  const currency = currencies[index % currencies.length];
  const planType = planTypes[index % planTypes.length];
  const groups = taxonomy[planType];
  const quantity = 1 + (index % 10);
  const unitPrice = 100 + (index % 25) * 20;
  const plan = {
    id: nextId++, company: partners[index % partners.length], type: "PARTNER", planType, group: groups[index % groups.length],
    invoiceDate: date(1 + (index % 10), 1 + (index % 20)), entryDate: date(1 + (index % 10), 1 + (index % 20)),
    due: date(11, 1 + (index % 20)), year: "2026", month: "KASIM", unitPrice, quantity, amount: unitPrice * quantity,
    paid: 0, currency, payment: "ÖDENMEDİ", order: "BEKLİYOR", description: `Stres testi planı ${index + 1}`,
    account: accounts.find((account) => account.currency === currency && account.type === accountTypes[index % accountTypes.length]).name,
  };
  plans.push(plan); operations.push({ operation: "plan", ...plan });
}

for (let index = 0; index < 250; index += 1) {
  const plan = plans[index];
  const amount = index % 3 === 0 ? plan.amount : Math.max(1, Math.round(plan.amount / 2));
  assert.ok(balances.get(plan.account) >= amount, `Yetersiz bakiye: ${plan.account}`);
  const row = {
    id: nextId++, kind: "cash-out", planId: plan.id, date: date(11, 1 + (index % 20)), recordDate: date(11, 1 + (index % 20)),
    movement: "ÇIKIŞ", movementType: "PARTNER ÖDEMESİ", payment: accounts.find((account) => account.name === plan.account).type,
    account: plan.account, amount, currency: plan.currency, note: `Stres testi plan ödemesi ${index + 1}`,
  };
  plan.paid += amount; plan.lastPaidDate = row.date; plan.payment = status(plan.amount, plan.paid);
  cashRows.push(row); operations.push(row); balances.set(row.account, balances.get(row.account) - amount);
}

for (let index = 0; index < 200; index += 1) {
  const source = accounts[index % accounts.length];
  const targetCurrency = index % 4 === 0 ? source.currency : currencies[(currencies.indexOf(source.currency) + 1 + (index % 2)) % currencies.length];
  const possibleTargets = accounts.filter((account) => account.currency === targetCurrency && account.name !== source.name);
  const target = possibleTargets[index % possibleTargets.length];
  const amount = 50 + (index % 20) * 5;
  const rate = source.currency === target.currency ? 1 : source.currency === "TRY" ? 0.03 : target.currency === "TRY" ? 33 : 0.92;
  const targetAmount = Math.round(amount * rate * 100) / 100;
  assert.ok(balances.get(source.name) >= amount, `Virman bakiyesi yetersiz: ${source.name}`);
  const row = {
    id: nextId++, kind: "currency", date: date(12, 1 + (index % 20)), recordDate: date(12, 1 + (index % 20)), movement: "VİRMAN", movementType: "VİRMAN",
    payment: source.type, account: source.name, amount, currency: source.currency, targetPayment: target.type, targetAmount, targetCurrency: target.currency,
    rate, note: `Stres testi virmanı ${index + 1}`,
  };
  cashRows.push(row); operations.push(row);
  balances.set(source.name, balances.get(source.name) - amount); balances.set(target.name, balances.get(target.name) + targetAmount);
}

assert.equal(operations.length, 1000, "İşlem sayısı 1.000 olmalı");
assert.equal(new Set(operations.map((item) => item.id)).size, 1000, "Mükerrer işlem kimliği var");
assert.equal(cashRows.filter((row) => row.kind === "cash-in").length, 300);
assert.equal(cashRows.filter((row) => row.kind === "cash-out").length, 250);
assert.equal(cashRows.filter((row) => row.kind === "currency").length, 200);
assert.equal(plans.length, 250);
for (const row of cashRows) {
  assert.ok(row.id && row.date && row.recordDate && row.movement && row.payment && row.account && row.amount > 0 && row.currency && row.note, `Eksik kasa alanı: ${row.id}`);
  const source = accounts.find((account) => account.name === row.account);
  assert.equal(source?.currency, row.currency, `Kaynak hesap/para birimi uyumsuz: ${row.id}`);
  if (row.kind === "currency") {
    const target = accounts.find((account) => account.currency === row.targetCurrency && account.type === row.targetPayment);
    assert.ok(target && target.name !== source.name && row.targetAmount > 0 && row.rate > 0, `Virman hedefi geçersiz: ${row.id}`);
    assert.equal(Math.round(row.amount * row.rate * 100) / 100, row.targetAmount, `Virman kuru uyuşmuyor: ${row.id}`);
  }
}
for (const plan of plans) {
  assert.ok(plan.company && plan.type && plan.planType && plan.group && plan.account && plan.description, `Eksik plan alanı: ${plan.id}`);
  assert.ok(taxonomy[plan.planType]?.includes(plan.group), `Tür/grup uyuşmuyor: ${plan.id}`);
  assert.equal(plan.amount, plan.unitPrice * plan.quantity, `Birim fiyat/adet toplamı uyuşmuyor: ${plan.id}`);
  assert.ok(plan.invoiceDate <= plan.due && plan.entryDate <= plan.due, `Tarih sırası geçersiz: ${plan.id}`);
  const paidFromLedger = cashRows.filter((row) => row.planId === plan.id).reduce((sum, row) => sum + row.amount, 0);
  assert.equal(plan.paid, paidFromLedger, `Plan/kasa çıkışı uyuşmuyor: ${plan.id}`);
  assert.equal(plan.payment, status(plan.amount, plan.paid), `Plan durumu uyuşmuyor: ${plan.id}`);
  assert.ok(plan.paid <= plan.amount, `Fazla ödeme var: ${plan.id}`);
}
for (const [account, balance] of balances) assert.ok(balance >= 0, `Negatif bakiye: ${account}`);
for (const currency of currencies) assert.ok(cashRows.some((row) => row.currency === currency), `${currency} işlemi yok`);
for (const accountType of accountTypes) assert.ok(cashRows.some((row) => row.payment === accountType), `${accountType} kullanılmadı`);
for (const planType of planTypes) assert.ok(plans.some((plan) => plan.planType === planType), `${planType} test edilmedi`);

const transferRows = cashRows.filter((row) => row.kind === "currency");
const transferTargets = transferRows.map((row) => accounts.find((account) => account.currency === row.targetCurrency && account.type === row.targetPayment));
const sameCurrencyTransfers = transferRows.filter((row) => row.currency === row.targetCurrency);
const crossCurrencyTransfers = transferRows.filter((row) => row.currency !== row.targetCurrency);
assert.ok(sameCurrencyTransfers.length > 0, "Aynı para biriminde hesaplar arası virman test edilmedi");
assert.ok(crossCurrencyTransfers.length > 0, "Farklı para birimleri arası virman test edilmedi");
for (const currency of currencies) {
  assert.ok(transferRows.some((row) => row.currency === currency), `${currency} gönderen hesap test edilmedi`);
  assert.ok(transferRows.some((row) => row.targetCurrency === currency), `${currency} alan hesap test edilmedi`);
}
for (const accountType of accountTypes) {
  assert.ok(transferRows.some((row) => row.payment === accountType), `${accountType} gönderen hesap test edilmedi`);
  assert.ok(transferRows.some((row) => row.targetPayment === accountType), `${accountType} alan hesap test edilmedi`);
}
const transferCoverage = {
  sameCurrency: sameCurrencyTransfers.length,
  crossCurrency: crossCurrencyTransfers.length,
  sourceAccounts: new Set(transferRows.map((row) => row.account)).size,
  targetAccounts: new Set(transferTargets.filter(Boolean).map((account) => account.name)).size,
  currencyPairs: Array.from(new Set(transferRows.map((row) => `${row.currency}->${row.targetCurrency}`))).sort(),
  accountTypePairs: Array.from(new Set(transferRows.map((row) => `${row.payment}->${row.targetPayment}`))).sort(),
};

const totals = Object.fromEntries(currencies.map((currency) => {
  const currencyAccounts = accounts.filter((account) => account.currency === currency);
  return [currency, Math.round(currencyAccounts.reduce((sum, account) => sum + balances.get(account.name), 0) * 100) / 100];
}));
console.log(JSON.stringify({
  result: "PASS",
  operations: operations.length,
  breakdown: { cashIn: 300, plans: 250, payments: 250, transfers: 200 },
  coverage: { currencies, accountTypes, planTypes: planTypes.length, partnerCount: partners.length },
  checks: 23,
  transferCoverage,
  negativeAccounts: Array.from(balances.values()).filter((value) => value < 0).length,
  endingBalancesByCurrency: totals,
}, null, 2));
