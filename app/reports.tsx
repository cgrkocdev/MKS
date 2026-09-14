"use client";

import { useEffect, useState, Fragment } from "react";
import type { Row, Plan, PaymentUnit } from "./page";

export const reportTitles = {
  "report-in": "Kasa Giriş Raporu",
  "report-out": "Kasa Çıkış Raporu",
  "report-company": "Firma Takip Raporu",
  "report-company-month": "Firma (AY) Raporu",
  "report-donation": "Bağış Raporu",
  "report-donation-month": "Bağış (AY) Raporu",
  "report-staff": "Personel Takip Raporu",
  "report-reconciliation": "KYP & MYS Raporu",
} as const;
export type ReportPage = keyof typeof reportTitles;
const months = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
const code = (value: string) => ({ DOLAR: "USD", EURO: "EUR", STERLİN: "GBP" })[value] ?? value;
const money = (value: number, currency: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: code(currency) }).format(value);
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
const blank = { group: "", country: "", region: "", company: "", year: "", month: "", invoiceStart: "", invoiceEnd: "", paymentStart: "", paymentEnd: "", currency: "", order: "", status: "", unpaid: false, detailed: false, byCompany: true };
type Filters = typeof blank;
type Item = { id: string; company: string; country: string; region: string; group: string; type: string; project: string; date: string; paymentDate: string; year: string; month: string; currency: string; order: string; amount: number; paid: number; remaining: number; note: string; invoice: string };
function Choice({ label, value, options, change }: { label: string; value: string; options: string[]; change: (value: string) => void }) {
  return <label className="report-field"><span>{label}</span><select value={value} onChange={(event) => change(event.target.value)}><option value="">--Seçiniz--</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
export default function Reports({ type, rows, plans, initialUnits }: { type: ReportPage; rows: Row[]; plans: Plan[]; initialUnits: PaymentUnit[] }) {
  const cash = type === "report-in" || type === "report-out";
  const monthly = type.endsWith("-month");
  const companySummary = type === "report-company" || type === "report-company-month" || type === "report-staff";
  const [units, setUnits] = useState(initialUnits);
  const [draft, setDraft] = useState<Filters>({ ...blank, unpaid: type === "report-donation" });
  const [filters, setFilters] = useState<Filters>({ ...blank, unpaid: type === "report-donation" });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("mks-payment-units") ?? "null"); if (Array.isArray(saved)) setUnits(saved); } catch { /* Retain available units. */ } }, []);
  const update = (key: keyof Filters, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value, ...(key === "country" ? { region: "" } : {}) }));
  const unitOf = (company: string) => units.find((unit) => unit.name === company);
  const items: Item[] = cash ? rows.filter((row) => type === "report-in" ? row.movement !== "ÇIKIŞ" && row.movement !== "VİRMAN" : row.movement === "ÇIKIŞ").map((row) => {
    const plan = plans.find((plan) => plan.id === row.planId);
    const unit = plan ? unitOf(plan.company) : undefined;
    return { id: `cash-${row.id}`, company: plan?.company ?? row.account, country: unit?.country ?? "", region: unit?.region ?? "", group: unit?.group ?? row.movementType ?? row.movement, type: row.payment, project: plan?.group ?? row.movement, date: row.date, paymentDate: row.date, year: row.date.slice(0, 4), month: months[Number(row.date.slice(5, 7)) - 1], currency: code(row.currency), order: plan?.order ?? "", amount: row.amount, paid: row.amount, remaining: 0, note: row.note, invoice: plan?.invoice ?? "" };
  }) : plans.map((plan) => {
    const unit = unitOf(plan.company);
    const paymentDate = rows.filter((row) => row.planId === plan.id).map((row) => row.date).sort().at(-1) ?? plan.lastPaidDate ?? "";
    return { id: `plan-${plan.id}`, company: plan.company, country: unit?.country ?? "", region: unit?.region ?? "", group: unit?.group ?? plan.type, type: plan.type, project: plan.group, date: plan.invoiceDate, paymentDate, year: plan.year, month: plan.month, currency: code(plan.currency), order: plan.order, amount: plan.amount, paid: plan.paid, remaining: Math.max(0, plan.amount - plan.paid), note: plan.description ?? "", invoice: plan.invoice };
  }).filter((item) => type !== "report-staff" || item.group === "PERSONEL" || item.type === "PERSONEL");
  const status = (item: Item) => item.remaining <= 0 && item.amount > 0 ? "ÖDENDİ" : item.paid > 0 ? "KISMİ" : "ÖDENMEDİ";
  const selected = items.filter((item) => {
    for (const key of ["group", "country", "region", "company", "year", "month", "currency", "order"] as const) if (filters[key] && item[key] !== filters[key]) return false;
    if (filters.unpaid && item.remaining <= 0) return false;
    if (filters.status && status(item) !== filters.status) return false;
    if (filters.invoiceStart && item.date < filters.invoiceStart || filters.invoiceEnd && item.date > filters.invoiceEnd) return false;
    if ((filters.paymentStart || filters.paymentEnd) && !item.paymentDate) return false;
    if (filters.paymentStart && item.paymentDate < filters.paymentStart || filters.paymentEnd && item.paymentDate > filters.paymentEnd) return false;
    return `${item.company} ${item.type} ${item.project} ${item.note} ${item.invoice}`.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"));
  });
  const grouped = new Map<string, { key: string; first: Item; items: Item[]; amount: number; paid: number; remaining: number }>();
  selected.forEach((item) => {
    const key = JSON.stringify([filters.detailed || cash ? item.id : "", item.country, filters.byCompany ? item.company : "", companySummary ? "" : item.type, companySummary ? "" : item.project, item.currency, monthly ? item.year : "", monthly ? item.month : ""]);
    const entry = grouped.get(key) ?? { key, first: { ...item }, items: [], amount: 0, paid: 0, remaining: 0 };
    if (entry.first.type !== item.type) entry.first.type = "Birden fazla tür";
    if (entry.first.project !== item.project) entry.first.project = "Birden fazla grup";
    entry.items.push(item); entry.amount += item.amount; entry.paid += item.paid; entry.remaining += item.remaining; grouped.set(key, entry);
  });
  const result = Array.from(grouped.values());
  const apply = () => {
    if (draft.invoiceStart && draft.invoiceEnd && draft.invoiceStart > draft.invoiceEnd || draft.paymentStart && draft.paymentEnd && draft.paymentStart > draft.paymentEnd) { setError("Başlangıç tarihi bitiş tarihinden sonra olamaz."); return; }
    setError(""); setFilters({ ...draft }); setExpanded(null);
  };
  const quick = (key: keyof Filters, value: string | boolean) => { setDraft((current) => ({ ...current, [key]: value })); setFilters((current) => ({ ...current, [key]: value })); setExpanded(null); };
  const choices = (key: "group" | "country" | "region" | "company" | "year" | "currency" | "order") => {
    const available = items.filter((item) => key !== "region" || !draft.country || item.country === draft.country).map((item) => item[key]);
    if (key === "group") return unique([...available, ...(type === "report-staff" ? ["PERSONEL"] : ["AYNİ", "BURS", "FİRMA", "GENEL", "PARTNER", "PERSONEL", "SOSYAL", "YETİM", "ZEKAT"])]);
    if (key === "year") return unique([...available, String(new Date().getFullYear())]);
    return unique(available);
  };
  const exportData = () => [["Ülke", "Firma", "Tür", "Grup", "Yıl", "Ay", "Adet", "Toplam Tutar", "Ödenen", "Kalan", "Para Birimi"], ...result.map((row) => [row.first.country, filters.byCompany ? row.first.company : "Tüm firmalar", row.first.type, row.first.project, monthly || filters.detailed || cash ? row.first.year : "", monthly || filters.detailed || cash ? row.first.month : "", row.items.length, row.amount, row.paid, row.remaining, row.first.currency])];
  const download = () => {
    const csv = "\uFEFF" + exportData().map((row) => row.map((cell) => { const value = String(cell); return '"' + (/^[=+@-]/.test(value) ? "'" : "") + value.replaceAll('"', '""') + '"'; }).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${type}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="reports-page">
    <h2>{reportTitles[type]}</h2>
    {type === "report-reconciliation" && <p className="report-note">Mevcut ödeme planları ve kasa kayıtlarının özeti. Harici KYP verisi bağlı olmadığı için sistemler arası karşılaştırma gösterilmez.</p>}
    <div className="report-card report-filter-grid">
      <label className="report-field"><span>ŞUBE</span><div className="fixed-value">YEDİRENK DERNEĞİ (GENEL MERKEZ)</div></label>
      <Choice label="PLANLANAN GRUP" value={draft.group} options={choices("group")} change={(v) => update("group", v)} />
      <Choice label="ÜLKE" value={draft.country} options={choices("country")} change={(v) => update("country", v)} />
      <Choice label="İL / BÖLGE" value={draft.region} options={choices("region")} change={(v) => update("region", v)} />
      <Choice label={cash ? "FİRMA / HESAP" : "PARTNER / FİRMA LİSTESİ"} value={draft.company} options={choices("company")} change={(v) => update("company", v)} />
      <Choice label="FAT. ÖDEME YILI" value={draft.year} options={choices("year")} change={(v) => update("year", v)} />
      <Choice label="FAT. ÖDEME AYI" value={draft.month} options={months} change={(v) => update("month", v)} />
      {([ ["invoiceStart", cash ? "İLK İŞLEM TARİHİ" : "İLK FATURA TARİHİ"], ["invoiceEnd", cash ? "SON İŞLEM TARİHİ" : "SON FATURA TARİHİ"], ["paymentStart", "İLK ÖDEME TARİHİ"], ["paymentEnd", "SON ÖDEME TARİHİ"]] as const).map(([key, label]) => <label key={key} className="report-field"><span>{label}</span><input type="date" value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      <Choice label="PARA BİRİMİ" value={draft.currency} options={["TRY", "USD", "EUR", "GBP"]} change={(v) => update("currency", v)} />
      <Choice label="SİPARİŞ DURUMU" value={draft.order} options={["BEKLİYOR", "VERİLDİ"]} change={(v) => update("order", v)} />
      <label className="report-check"><input type="checkbox" checked={draft.detailed} onChange={(e) => update("detailed", e.target.checked)} /> Detaylı liste getir</label>
      <label className="report-check"><input type="checkbox" checked={draft.unpaid} onChange={(e) => update("unpaid", e.target.checked)} disabled={cash} /> Sadece ödenmeyenler</label>
      <button className="search" onClick={apply}>Sorgula</button>
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="report-card">
      <h3>Hızlı Sorgu</h3>
      <div className="report-quick-grid">
        <Choice label="YIL" value={filters.year} options={choices("year")} change={(v) => quick("year", v)} />
        <Choice label="PLANLANAN GRUP" value={filters.group} options={choices("group")} change={(v) => quick("group", v)} />
        <label className="report-check"><input type="checkbox" checked={filters.byCompany} onChange={(e) => quick("byCompany", e.target.checked)} /> Firma adına göre grupla</label>
        <Choice label="PARTNER / FİRMA" value={filters.company} options={choices("company")} change={(v) => quick("company", v)} />
        <Choice label="PARA BİRİMİ" value={filters.currency} options={["TRY", "USD", "EUR", "GBP"]} change={(v) => quick("currency", v)} />
        <Choice label="SİPARİŞ DURUMU" value={filters.order} options={["BEKLİYOR", "VERİLDİ"]} change={(v) => quick("order", v)} />
        <Choice label="ÖDEME DURUMU" value={filters.status} options={["ÖDENMEDİ", "KISMİ", "ÖDENDİ"]} change={(v) => { quick("status", v); if (v === "ÖDENDİ") quick("unpaid", false); }} />
      </div>
      <h3>{type.includes("donation") ? "Bağış Sipariş Tablosu" : reportTitles[type]}</h3>
      <div className="report-toolbar"><button onClick={async () => { try { await navigator.clipboard.writeText(exportData().map((row) => row.join("\t")).join("\n")); setFeedback("Kopyalandı."); } catch { setFeedback("Panoya erişilemedi; CSV indirebilirsiniz."); } }}>Kopyala</button><button onClick={download}>Excel (CSV)</button><button onClick={() => window.print()}>Yazdır</button><button onClick={() => { setDraft({ ...blank }); setFilters({ ...blank }); setSearch(""); setError(""); }}>Filtreleri Temizle</button><label>Arama <input value={search} onChange={(e) => setSearch(e.target.value)} /></label><span role="status">{feedback}</span></div>
      <div className="report-table-wrap"><table className="report-table"><thead><tr>{["Detay", "Ülke", "Partner / Firma", "Tür", "Grup", ...(monthly || filters.detailed || cash ? ["Yıl / Ay"] : []), "Adet", cash ? "Toplam Tutar" : "Toplam Borç", "Toplam Ödenen", "Kalan Borç", "Para Birimi"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>
        {result.map((row) => <Fragment key={row.key}><tr><td><button onClick={() => setExpanded(expanded === row.key ? null : row.key)} aria-expanded={expanded === row.key}>Detay Göster</button></td><td>{row.first.country || "—"}</td><td>{filters.byCompany ? row.first.company : "Tüm firmalar"}</td><td>{row.first.type}</td><td>{row.first.project}</td>{(monthly || filters.detailed || cash) && <td>{row.first.year} / {row.first.month}</td>}<td>{row.items.length}</td><td>{money(row.amount, row.first.currency)}</td><td>{money(row.paid, row.first.currency)}</td><td>{money(row.remaining, row.first.currency)}</td><td>{row.first.currency}</td></tr>{expanded === row.key && <tr><td colSpan={monthly || filters.detailed || cash ? 11 : 10}><div className="report-details">{row.items.map((item) => <p key={item.id}><strong>{item.company}</strong> · Fatura: {item.invoice || "—"} · Tarih: {item.date} · Son ödeme: {item.paymentDate || "—"} · {money(item.amount, item.currency)} · Ödenen: {money(item.paid, item.currency)} · Kalan: {money(item.remaining, item.currency)} · {status(item)} {item.note && `· ${item.note}`}</p>)}</div></td></tr>}</Fragment>)}
        {!result.length && <tr><td colSpan={monthly || filters.detailed || cash ? 11 : 10} className="none">Seçilen filtrelere uygun kayıt bulunamadı.</td></tr>}
      </tbody></table></div>
      <p className="report-count">{selected.length} kayıt, {result.length} rapor satırı. Farklı para birimleri ayrı hesaplanır.</p>
    </div>
  </section>;
}
