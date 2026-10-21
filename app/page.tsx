"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import mksLogo from "../public/mks-logo-clean.png";
import Reports, { reportTitles, type ReportPage } from "./reports";
import { formatDate, TurkishDateInput } from "./date";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Landmark,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Printer,
  Search,
  Trash2,
  UserRound,
  X,
  Coins,
  Wallet,
  Clock3,
  Users,
  ShieldCheck,
  Zap,
  BarChart3,
  Filter,
} from "lucide-react";
type Page =
  "home" | "cash-in" | "transfer" | "currency" | "cash-out" | "planning" | ReportPage;
export type Row = {
  kind?: "cash-in" | "cash-out" | "transfer" | "currency";
  movementType?: string;
  recordDate?: string;
  rate?: number;
  id: number;
  date: string;
  movement: string;
  payment: string;
  account: string;
  amount: number;
  currency: string;
  note: string;
  targetPayment?: string;
  targetAmount?: number;
  targetCurrency?: string;
  planId?: number;
  debtName?: string;
};
export type Plan = {
  lastPaidDate?: string;
  entryDate?: string;
  salary?: string;
  id: number;
  company: string;
  type: string;
  group: string;
  invoiceDate: string;
  due: string;
  year: string;
  month: string;
  amount: number;
  paid: number;
  currency: string;
  payment: string;
  order: string;
  installments?: number;
  description?: string;
  donationGap?: number;
  account?: string;
};
type PlanInput = Omit<Plan, "id" | "paid" | "payment">;
export type PaymentUnit = {
  id: number;
  scope: "Kampüs" | "Genel" | "ÇBY" | "Proje";
  group: string;
  name: string;
  branch: string;
  country: string;
  region: string;
  phone: string;
  status: "AKTİF" | "PASİF";
};
const today = new Date().toLocaleDateString("sv-SE"),
  branch = "YEDİRENK DERNEĞİ (GENEL MERKEZ)";
let lastNumericId = Date.now() * 1000;
const createNumericId = () => {
  lastNumericId = Math.max(Date.now() * 1000, lastNumericId + 1);
  return lastNumericId;
};
const isValidIsoDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day;
};
const accountTypes = ["NAKİT", "BANKA", "ÇEK", "SENET", "KREDİ KARTI"];
const accountCurrencyLabels: Record<string, string> = {
  TRY: "TL",
  USD: "Dolar",
  EUR: "Euro",
};
const accounts = ["TRY", "USD", "EUR"].flatMap((currency) =>
  accountTypes.map((type) => ({
    name: `${accountCurrencyLabels[currency]} ${type === "NAKİT" ? "Nakit Kasa" : type === "BANKA" ? "Banka Hesabı" : type}`,
    type,
    currency,
    opening: 0,
    reserved: 0,
  })),
);
const legacyAccountNames: Record<string, string> = {
  "Merkez Nakit Kasa": "TL Nakit Kasa",
  "Ziraat Bankası • 1025": "TL Banka Hesabı",
  "Vakıf Katılım • 2048": "TL Banka Hesabı",
  "Dolar Nakit Kasa": "Dolar Nakit Kasa",
  "Euro Nakit Kasa": "Euro Nakit Kasa",
};
const normalizeAccountName = (name?: string) => name ? legacyAccountNames[name] ?? name : "";
const movementTypes = [
  "--Seçiniz--",
  "YEDİRENK",
  "SERMAYE",
  "EMANET",
  "SERBEST BAĞIŞ",
];
const paymentTypes = [
  "--Seçiniz--",
  "NAKİT",
  "BANKA",
  "ÇEK",
  "SENET",
  "KREDİ KARTI",
];
const currencyTypes = ["TRY", "DOLAR", "EURO"];
const currencyCode = (currency: string) =>
  ({ TL: "TRY", DOLAR: "USD", EURO: "EUR" })[currency] ?? currency;
const getAccountBalance = (rows: Row[], accountName: string, currency: string) =>
  rows.reduce((balance, row) => {
    if (row.movement === "VİRMAN") {
      const source = normalizeAccountName(row.account);
      const targetCurrency = currencyCode(row.targetCurrency ?? "");
      const targetType = row.targetPayment ?? "NAKİT";
      const target = accounts.find((item) => item.currency === targetCurrency && item.type === targetType)?.name;
      if (source === accountName && currencyCode(row.currency) === currency) balance -= row.amount;
      if (target === accountName && targetCurrency === currency) balance += row.targetAmount ?? 0;
      return balance;
    }
    if (normalizeAccountName(row.account) !== accountName || currencyCode(row.currency) !== currency) return balance;
    return balance + (row.movement === "ÇIKIŞ" ? -row.amount : row.amount);
  }, 0);
const isSterling = (currency?: string) =>
  currency === "GBP" || currency === "STERLİN";
const fmt = (n: number, c = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currencyCode(c),
  }).format(n);
function totalsByCurrency<T>(
  items: T[],
  amount: (item: T) => number,
  currency: (item: T) => string,
) {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const code = currencyCode(currency(item));
    totals.set(code, (totals.get(code) ?? 0) + amount(item));
  });
  return Array.from(totals, ([code, total]) => fmt(total, code)).join(" / ") || fmt(0);
}
const planStatus = (amount: number, paid: number) =>
  amount > 0 && paid >= amount ? "ÖDENDİ" : paid > 0 ? "KISMİ" : "ÖDENMEDİ";
const outgoingCountries = [
  "AFGANİSTAN",
  "BANGLADEŞ",
  "ÇAD",
  "ETİYOPYA",
  "FİLİSTİN",
  "SERBEST",
  "SOMALİ",
  "TANZANYA",
  "TÜRKİYE",
  "UGANDA",
  "YEMEN",
];
const partnerCatalog: Array<{
  name: string;
  country: string;
  region: string;
  status: PaymentUnit["status"];
}> = [
  { name: "YEDİRENK DERNEĞİ", country: "TÜRKİYE", region: "ANADOLU-1", status: "AKTİF" },
  { name: "BERR GLOBAL", country: "UGANDA", region: "KAMPALA-1", status: "AKTİF" },
  { name: "AFRİKA DAYANIŞMA AĞI", country: "SERBEST", region: "SAHRA-1", status: "PASİF" },
  { name: "DAMAL", country: "SOMALİ", region: "MOGADİŞU-1", status: "AKTİF" },
  { name: "MEWLANA", country: "BANGLADEŞ", region: "DAKKA-1", status: "AKTİF" },
  { name: "HAKİD", country: "ETİYOPYA", region: "ADDİS ABABA-1", status: "AKTİF" },
  { name: "KEDEV", country: "ÇAD", region: "ENCEMİNE-1", status: "AKTİF" },
  { name: "İNSAN DERNEĞİ", country: "TANZANYA", region: "DARÜSSELAM-1", status: "AKTİF" },
  { name: "GÜZEL ESER", country: "YEMEN", region: "SANA-1", status: "AKTİF" },
  { name: "YAOUNDÉ DAYANIŞMA VAKFI", country: "SERBEST", region: "YAOUNDÉ-1", status: "PASİF" },
  { name: "CHASM-E-OMİD", country: "AFGANİSTAN", region: "KABİL-1", status: "AKTİF" },
  { name: "SENABİL", country: "FİLİSTİN", region: "GAZZE-1", status: "AKTİF" },
  { name: "ŞAM İYİLİK VAKFI", country: "SERBEST", region: "İDLİB-1", status: "PASİF" },
  { name: "ANADOLU YEDİRENK DERNEĞİ", country: "TÜRKİYE", region: "ANADOLU-1", status: "PASİF" },
];
const partnerNames = partnerCatalog.map((partner) => partner.name);
export const planningGroupTypes: Record<string, string[]> = {
  PARTNER: partnerNames,
  "CARİ GİDERLER": [
    "KİRA",
    "AİDAT",
    "MUHASEBE",
    "BANKA MASRAFLARI",
    "VERGİ VE HARÇLAR",
    "SİGORTA",
    "KARGO VE KURYE",
    "DİĞER CARİ GİDER",
  ],
  FATURALAR: [
    "ELEKTRİK",
    "SU",
    "DOĞALGAZ",
    "İNTERNET",
    "TELEFON",
    "MOBİL HAT",
    "YAKIT",
    "DİĞER FATURA",
  ],
  "PERSONEL GİDERLERİ": [
    "MAAŞ",
    "SGK PRİMİ",
    "YOL",
    "YEMEK",
    "AVANS",
    "PRİM / İKRAMİYE",
    "TAZMİNAT",
    "DİĞER PERSONEL GİDERİ",
  ],
  "ALIŞVERİŞ": [
    "OFİS MALZEMESİ",
    "TEMİZLİK MALZEMESİ",
    "GIDA",
    "DEMİRBAŞ",
    "TEKNOLOJİ",
    "MOBİLYA",
    "BAKIM / ONARIM",
    "DİĞER ALIŞVERİŞ",
  ],
};
export const planningGroups = Object.keys(planningGroupTypes);
const planningTypeNames = Object.values(planningGroupTypes).flat();
const partnerNameAliases: Record<string, string> = {
    "BERR GLOBAL UGANDA": "BERR GLOBAL",
    "CHASHM-E-OMID CHARITY ORGANIZATION": "CHASM-E-OMİD",
};
const normalizePartnerName = (name: string) => partnerNameAliases[name] ?? name;
const plansSeed: Plan[] = [
  {
    id: 1,
    company: "BERR GLOBAL",
    type: "PARTNER",
    group: "ÇEŞMELİ",
    invoiceDate: "2026-07-31",
    due: "2026-07-31",
    year: "2026",
    month: "TEMMUZ",
    amount: 2750,
    paid: 2750,
    currency: "USD",
    payment: "ÖDENDİ",
    order: "VERİLDİ",
  },
  {
    id: 2,
    company: "BERR GLOBAL",
    type: "PARTNER",
    group: "TULUMBA",
    invoiceDate: "2026-07-31",
    due: "2026-07-31",
    year: "2026",
    month: "TEMMUZ",
    amount: 1750,
    paid: 1750,
    currency: "USD",
    payment: "ÖDENDİ",
    order: "VERİLDİ",
  },
  {
    id: 3,
    company: "BERR GLOBAL",
    type: "PARTNER",
    group: "NAFİLE KURBAN",
    invoiceDate: "2026-06-30",
    due: "2026-06-30",
    year: "2026",
    month: "HAZİRAN",
    amount: 9636,
    paid: 9636,
    currency: "USD",
    payment: "ÖDENDİ",
    order: "VERİLDİ",
  },
  {
    id: 4,
    company: "CHASM-E-OMİD",
    type: "PARTNER",
    group: "CAMİ İNŞAATI",
    invoiceDate: "2026-09-15",
    due: "2026-09-30",
    year: "2026",
    month: "EYLÜL",
    amount: 25000,
    paid: 0,
    currency: "USD",
    payment: "ÖDENMEDİ",
    order: "BEKLİYOR",
  },
];
const rowsSeed: Row[] = [];
const partnerUnitsSeed: PaymentUnit[] = partnerCatalog.map((partner, index) => ({
  id: 101 + index,
  scope: "Genel",
  group: "PARTNER",
  name: partner.name,
  branch,
  country: partner.country,
  region: partner.region,
  phone: "",
  status: partner.status,
}));
const expenseUnitsSeed: PaymentUnit[] = planningGroups
  .filter((group) => group !== "PARTNER")
  .flatMap((group, groupIndex) =>
    planningGroupTypes[group].map((name, typeIndex) => ({
      id: 1000 + groupIndex * 100 + typeIndex,
      scope: "Genel",
      group,
      name,
      branch,
      country: "",
      region: "",
      phone: "",
      status: "AKTİF" as PaymentUnit["status"],
    })),
  );
const paymentUnitsSeed: PaymentUnit[] = [...partnerUnitsSeed, ...expenseUnitsSeed];
const completePaymentUnits = (saved: unknown): PaymentUnit[] => {
  const savedUnits = Array.isArray(saved) ? saved as PaymentUnit[] : [];
  return paymentUnitsSeed.map((catalogUnit) => {
    const stored = savedUnits.find(
      (unit) => unit?.name === catalogUnit.name && unit?.group === catalogUnit.group,
    );
    return stored
      ? { ...stored, name: catalogUnit.name, group: catalogUnit.group, country: catalogUnit.country, region: catalogUnit.region }
      : catalogUnit;
  });
};

export default function Home() {
  const [page, setPage] = useState<Page>("home"),
    [open, setOpen] = useState<"in" | "out" | "plan" | "reports" | null>(null),
    [rows, setRows] = useState<Row[]>(rowsSeed),
    [plans, setPlans] = useState<Plan[]>(plansSeed),
    [paying, setPaying] = useState<Plan | null>(null),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [authenticated, setAuthenticated] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [dataReady, setDataReady] = useState(false);
  useEffect(() => {
    setAuthenticated(localStorage.getItem("mks-session") === "active");
    setAuthReady(true);
  }, []);
  useEffect(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem("mks-finance-snapshot") ?? "null") as { rows?: Row[]; plans?: Plan[] } | null;
      const savedRows = snapshot?.rows ? JSON.stringify(snapshot.rows) : localStorage.getItem("mks-cash-rows");
      const savedPlans = snapshot?.plans ? JSON.stringify(snapshot.plans) : localStorage.getItem("mks-payment-plans");
      if (savedRows) {
        const storedRows = JSON.parse(savedRows) as Row[];
        setRows(
          storedRows
            .filter((row) => !isSterling(row.currency) && !isSterling(row.targetCurrency))
            .map((row) => ({
              ...row,
              account: normalizeAccountName(row.account),
              payment: normalizeAccountName(row.payment),
              targetPayment: row.targetPayment ? normalizeAccountName(row.targetPayment) : row.targetPayment,
            })),
        );
      }
      if (savedPlans) {
        const storedPlans = JSON.parse(savedPlans) as Plan[];
        const storedPaymentRows = savedRows ? JSON.parse(savedRows) as Row[] : [];
        setPlans(
          storedPlans.map((plan) => {
            const amount = Math.max(0, Number(plan.amount) || 0);
            const paid = Math.min(amount, Math.max(0, Number(plan.paid) || 0));
            const transactionDate = storedPaymentRows
              .filter((row) => row.planId === plan.id && isValidIsoDate(row.date))
              .map((row) => row.date)
              .sort()
              .at(-1);
            const inferredPaymentDate = paid > 0
              ? transactionDate
                ?? (isValidIsoDate(plan.lastPaidDate) ? plan.lastPaidDate : undefined)
                ?? (isValidIsoDate(plan.invoiceDate) ? plan.invoiceDate : undefined)
                ?? (isValidIsoDate(plan.due) ? plan.due : undefined)
              : undefined;
            return {
              ...plan,
              company: normalizePartnerName(plan.company),
              account: normalizeAccountName(plan.account),
              type: partnerNames.includes(normalizePartnerName(plan.company))
                ? "PARTNER"
                : plan.type,
              amount,
              paid,
              lastPaidDate: inferredPaymentDate,
              payment: planStatus(amount, paid),
            };
          }).filter(
            (plan) =>
              planningTypeNames.includes(plan.company) && !isSterling(plan.currency),
          ),
        );
      }
    } catch {
      localStorage.removeItem("mks-cash-rows");
      localStorage.removeItem("mks-payment-plans");
      localStorage.removeItem("mks-finance-snapshot");
    } finally {
      setDataReady(true);
    }
  }, []);
  useEffect(() => {
    if (!dataReady) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.removeItem("mks-cash-rows");
        localStorage.removeItem("mks-payment-plans");
        localStorage.setItem("mks-finance-snapshot", JSON.stringify({ rows, plans }));
      } catch {
        setNotice("Kayıt alanı doldu. Verilerin kaybolmaması için CSV yedeği alın ve eski kayıtları arşivleyin.");
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [rows, plans, dataReady]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const go = (p: Page) => {
    setPage(p);
    setMobile(false);
  };
  if (!authReady) return <div className="auth-loading">MKS</div>;
  if (!authenticated)
    return (
      <Login
        onLogin={(remember) => {
          if (remember) localStorage.setItem("mks-session", "active");
          setAuthenticated(true);
        }}
      />
    );
  return (
    <div className="shell">
      {mobile && <button className="menu-backdrop" aria-label="Menüyü kapat" onClick={() => setMobile(false)} />}
      <aside className={mobile ? "side show" : "side"}>
        <div className="side-brand" onClick={() => go("home")}>
          <div className="brand-logo-frame">
            <Image src={mksLogo} alt="MKS" priority />
          </div>
          <div>
            <small>Güvenli finansal çözümler</small>
          </div>
          <button
            aria-label="Menüyü kapat"
            onClick={(e) => {
              e.stopPropagation();
              setMobile(false);
            }}
          >
            <X />
          </button>
        </div>
        <nav>
          <Nav
            text="GENEL KASA"
            active={page === "home"}
            open={false}
            expandable={false}
            click={() => go("home")}
            icon={<Landmark />}
          />
          <Nav
            text="KASA GİRİŞ"
            active={["cash-in", "transfer", "currency"].includes(page)}
            open={open === "in"}
            click={() => setOpen(open === "in" ? null : "in")}
            icon={<Banknote />}
          />
          {open === "in" && (
            <div className="sub">
              <Sub
                text="Kasa Giriş"
                on={page === "cash-in"}
                click={() => go("cash-in")}
              />
              <Sub
                text="Kasa Virman"
                on={page === "currency"}
                click={() => go("currency")}
              />
            </div>
          )}
          <Nav
            text="KASA ÇIKIŞ"
            active={page === "cash-out"}
            open={open === "out"}
            click={() => setOpen(open === "out" ? null : "out")}
            icon={<Banknote />}
          />
          {open === "out" && (
            <div className="sub">
              <Sub
                text="Kasa Çıkış"
                on={page === "cash-out"}
                click={() => go("cash-out")}
              />
            </div>
          )}
          <Nav text="RAPORLAR" active={page in reportTitles} open={open === "reports"} click={() => setOpen(open === "reports" ? null : "reports")} icon={<FileSpreadsheet />} />
          {open === "reports" && <div className="sub">{Object.entries(reportTitles).map(([key, label]) => <Sub key={key} text={label} on={page === key} click={() => go(key as ReportPage)} />)}</div>}
          <Nav
            text="PLANLAMA"
            active={page === "planning"}
            open={open === "plan"}
            click={() => setOpen(open === "plan" ? null : "plan")}
            icon={<CalendarDays />}
          />
          {open === "plan" && (
            <div className="sub">
              <Sub
                text="Firma Ödeme Planlama"
                on={page === "planning"}
                click={() => go("planning")}
              />
            </div>
          )}
        </nav>
        <div className="brand-story"><div className="mountain-art" aria-hidden="true" /><p>Sağlam finans,<br />sürdürülebilir yarınlar.</p><span /></div>
        <div className="year">
          <small>ÇALIŞMA DÖNEMİ</small>
          <b>MKS 2026</b>
        </div>
      </aside>
      <main>
        <header>
          <button
            className="hamb"
            aria-label="Menüyü aç"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <label className="top-search">
            <Search />
            <input aria-label="Menüde ara" placeholder="Firma, fatura, ödeme planı veya müşteri ara..." />
          </label>
          <div className="crumb">
            KASA <span>›</span> {title(page)}
          </div>
          <div className="profile">
            <span className="profile-avatar">AS</span>
            <div>
              ARAFAT ŞİMŞEK <small>{branch}</small>
            </div>
            <CircleUserRound />
            <button
              className="logout"
              title="Çıkış yap"
              aria-label="Çıkış yap"
              onClick={() => {
                localStorage.removeItem("mks-session");
                setAuthenticated(false);
              }}
            >
              <LogOut />
            </button>
          </div>
        </header>
        <div className="workspace">
          {page in reportTitles ? (
            <Reports key={page} type={page as ReportPage} rows={rows} plans={plans} initialUnits={paymentUnitsSeed} />
          ) : page === "home" ? (
            <Summary rows={rows} />
          ) : page === "planning" ? (
            <Planning plans={plans} setPlans={setPlans} openPay={setPaying} />
          ) : page === "cash-out" ? (
            <CashOut plans={plans} rows={rows} openPay={setPaying} />
          ) : (
            <CashPage key={page} type={page as "cash-in" | "transfer" | "currency"} rows={rows} setRows={setRows} />
          )}
        </div>
        <footer>MKS Ön Muhasebe ©2026</footer>
      </main>
      {paying && (
        <Payment
          plan={paying}
          transactions={rows.filter((row) => row.planId === paying.id)}
          rows={rows}
          close={() => setPaying(null)}
          pay={(amount, account, note) => {
            const remaining = Math.max(0, paying.amount - paying.paid);
            const paidAmount = Math.min(amount, remaining);
            if (paidAmount <= 0) return;
            setPlans(
              plans.map((p) =>
                p.id === paying.id
                  ? {
                      ...p,
                      paid: p.paid + paidAmount,
                      account,
                      lastPaidDate: today,
                      payment: planStatus(p.amount, p.paid + paidAmount),
                    }
                  : p,
              ),
            );
            setRows([
              {
                id: createNumericId(),
                date: today,
                movement: "ÇIKIŞ",
                payment: accounts.find((item) => item.name === account)?.type ?? "NAKİT",
                account,
                amount: paidAmount,
                currency: paying.currency,
                note: `${paying.company} - ${note || paying.group}`,
                planId: paying.id,
              },
              ...rows,
            ]);
            setNotice(
              `${fmt(paidAmount, paying.currency)} ödeme kaydedildi ve ${account} hesabından düşüldü.`,
            );
            setPaying(null);
          }}
        />
      )}
      {notice ? (
        <div className="success-toast" role="status" aria-live="polite">
          <CheckCircle2 />
          <span>{notice}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (remember: boolean) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (username.trim().toLowerCase() === "admin" && password === "MKS2026") {
      setError("");
      onLogin(remember);
      return;
    }
    setError("Kullanıcı adı veya şifre hatalı.");
  };
  return (
    <main className="login-page">
      <section className="login-presentation">
        <div className="login-brand">
          <span className="login-logo-frame">
            <Image src={mksLogo} alt="MKS" priority />
          </span>
          <div>
            <small>Muhasebe Kontrol Sistemi</small>
          </div>
        </div>
        <div className="login-message">
          <span className="secure-chip" aria-hidden="true" />
          <h1>
            Finansal
            <br />
            kontrol, daha<br /><em>aydınlık yarınlar.</em>
          </h1>
          <p>
            Tüm finansal süreçlerinizi tek platformda yönetin, kontrolü elinizde tutun, geleceğe güvenle ilerleyin.
          </p>
        </div>
        <div className="login-features">
          <div><BarChart3 /><p><b>Tek Platform</b><small>Muhasebe süreçlerinizin tamamı tek ekranda.</small></p></div>
          <div><ShieldCheck /><p><b>Düzenli Veri</b><small>Finansal kayıtlarınız bir arada.</small></p></div>
          <div><Zap /><p><b>Daha Verimli Süreçler</b><small>Zamandan tasarruf edin, odağınızı büyümeye ayırın.</small></p></div>
        </div>
        <blockquote>“ Veriyi kontrol eden,<br /> geleceği şekillendirir. ”</blockquote>
      </section>
      <section className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-login-brand">
            <Image src={mksLogo} alt="MKS" priority />
            <small>Muhasebe Kontrol Sistemi</small>
          </div>
          <span className="welcome">Güvenli<br />Sürdürülebilir<br />Kontrollü</span>
          <h2>Hesabınıza Hoş Geldiniz</h2>
          <p>Muhasebe süreçlerinizi güvenle yönetin.</p>
          <label className="login-field">
            <span>Kullanıcı adı</span>
            <div>
              <UserRound />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adı veya e-posta"
              />
            </div>
          </label>
          <label className="login-field">
            <span>Şifre</span>
            <div>
              <LockKeyhole />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifreniz"
              />
              <button
                type="button"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <div className="login-options">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              Beni hatırla
            </label>
            <button type="button" onClick={() => setError("Şifre sıfırlama için kurum yöneticinizle iletişime geçin. Demo giriş bilgileri aşağıda yer alıyor.")}>Şifremi unuttum</button>
          </div>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-submit" type="submit">
            Giriş Yap <ArrowRight />
          </button>
          <div className="login-divider">veya</div>
          <button type="button" className="sso-button" onClick={() => setError("Kurumsal SSO bağlantısı henüz yapılandırılmadı. Kullanıcı adı ve şifrenizle giriş yapabilirsiniz.")}>SSO ile Giriş Yap</button>
          <p className="login-contact">Hesabınız yok mu? <button type="button" onClick={() => setError("Hesap açılması için kurum yöneticinizle iletişime geçin.")}>Yetkili ile iletişime geçin.</button></p>
          <details className="demo-info"><summary>Demo giriş bilgileri</summary>
            <b>Demo giriş bilgileri</b>
            <span>
              Kullanıcı adı: <strong>admin</strong>
            </span>
            <span>
              Şifre: <strong>MKS2026</strong>
            </span>
          </details>
          <div className="login-security">
            <ShieldCheck /> MKS · Muhasebe Kontrol Sistemi
          </div>
        </form>
      </section>
      <div className="login-bottom">MKS 2026 <span>Muhasebe Kontrol Sistemi</span></div>
    </main>
  );
}
function Nav({
  text,
  icon,
  active,
  open,
  expandable = true,
  click,
}: {
  text: string;
  icon: React.ReactNode;
  active: boolean;
  open: boolean;
  expandable?: boolean;
  click: () => void;
}) {
  return (
    <button className={"nav-main " + (active ? "active" : "")} onClick={click}>
      {icon}
      <span>{text}</span>
      {expandable ? <ChevronDown className={open ? "turn" : ""} /> : null}
    </button>
  );
}
function Sub({
  text,
  on,
  click,
}: {
  text: string;
  on: boolean;
  click: () => void;
}) {
  return (
    <button className={on ? "on" : ""} onClick={click}>
      <ArrowRight />
      {text}
    </button>
  );
}
function title(p: Page) {
  return (
    {
      home: "GENEL KASA",
      "cash-in": "KASA GİRİŞ",
      transfer: "KASA VİRMAN",
      currency: "KASA VİRMAN",
      "cash-out": "KASA ÇIKIŞ",
      planning: "FİRMA ÖDEME PLANLAMA",
      ...reportTitles,
    } as const
  )[p];
}
function Summary({ rows }: { rows: Row[] }) {
  const [chartCurrency, setChartCurrency] = useState("TRY");
  const tableData = (currency: string) => {
    const summaryPaymentTypes = ["NAKİT", "BANKA", "ÇEK", "SENET", "KREDİ KARTI"];
    const category = (payment: string) =>
      summaryPaymentTypes.includes(payment) ? payment : "NAKİT";
    return summaryPaymentTypes.map((paymentType) => {
      const matchingAccounts = accounts.filter((account) => {
        const accountType = account.type === "BANKA" ? "BANKA" : "NAKİT";
        return account.currency === currency && accountType === paymentType;
      });
      const accountNames = new Set(
        matchingAccounts.map((account) => account.name),
      );
      const opening = matchingAccounts.reduce(
        (total, account) => total + account.opening,
        0,
      );
      const matchingRows = rows.filter(
        (row) =>
          currencyCode(row.currency) === currency &&
          row.movement !== "VİRMAN" &&
          category(row.payment) === paymentType,
      );
      const transactionIncome = matchingRows
        .filter((row) => row.movement !== "ÇIKIŞ")
        .reduce((total, row) => total + row.amount, 0);
      const expense = matchingRows
        .filter((row) => row.movement === "ÇIKIŞ")
        .reduce((total, row) => total + row.amount, 0);
      const transferIncome = rows
        .filter(
          (row) =>
            row.movement === "VİRMAN" &&
            currencyCode(row.targetCurrency ?? "") === currency &&
            category(row.targetPayment ?? "NAKİT") === paymentType,
        )
        .reduce((total, row) => total + (row.targetAmount ?? 0), 0);
      const transferExpense = rows
        .filter(
          (row) =>
            row.movement === "VİRMAN" &&
            currencyCode(row.currency) === currency &&
            category(row.payment) === paymentType,
        )
        .reduce((total, row) => total + row.amount, 0);
      const income = opening + transactionIncome + transferIncome;
      const totalExpense = expense + transferExpense;
      return {
        paymentType,
        income,
        expense: totalExpense,
        balance: income - totalExpense,
      };
    });
  };
  const currencySummaries = ["TRY", "USD", "EUR"].map((currency) => {
    const data = tableData(currency);
    const totals = data.reduce(
      (result, item) => ({
        income: result.income + item.income,
        expense: result.expense + item.expense,
        balance: result.balance + item.balance,
      }),
      { income: 0, expense: 0, balance: 0 },
    );
    const availableBalance = data
      .filter((item) => item.paymentType === "NAKİT" || item.paymentType === "BANKA")
      .reduce((total, item) => total + item.balance, 0);
    return { currency, data, totals, availableBalance };
  });
  const selectedSummary = currencySummaries.find(
    (summary) => summary.currency === chartCurrency,
  ) ?? currencySummaries[0];
  const chartColors = ["#10b981", "#2563eb", "#f59e0b", "#8b5cf6", "#ec4899"];
  const distributionTotal = selectedSummary.data.reduce(
    (total, item) => total + Math.max(0, item.balance),
    0,
  );
  let distributionOffset = 0;
  const distributionGradient = distributionTotal > 0
    ? `conic-gradient(${selectedSummary.data.map((item, index) => {
        const start = distributionOffset;
        distributionOffset += Math.max(0, item.balance) / distributionTotal * 100;
        return `${chartColors[index]} ${start}% ${distributionOffset}%`;
      }).join(", ")})`
    : chartCurrency === "EUR" ? "#2563eb" : "#e5e7eb";
  const monthLabels = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  let runningBalance = 0;
  const monthlyFlow = monthLabels.map((month, index) => {
    const monthCode = String(index + 1).padStart(2, "0");
    const monthRows = rows.filter((row) => row.date.slice(0, 7) === `${today.slice(0, 4)}-${monthCode}`);
    let income = 0;
    let expense = 0;
    monthRows.forEach((row) => {
      if (row.movement === "VİRMAN") {
        if (currencyCode(row.targetCurrency ?? "") === chartCurrency) income += row.targetAmount ?? 0;
        if (currencyCode(row.currency) === chartCurrency) expense += row.amount;
      } else if (currencyCode(row.currency) === chartCurrency) {
        if (row.movement === "ÇIKIŞ") expense += row.amount;
        else income += row.amount;
      }
    });
    runningBalance += income - expense;
    return { month, income, expense, balance: runningBalance };
  });
  const trendValues = monthlyFlow.flatMap((item) => [item.income, item.expense, item.balance]);
  const trendMin = Math.min(0, ...trendValues);
  const trendMax = Math.max(1, ...trendValues);
  const trendRange = trendMax - trendMin || 1;
  const trendPoints = (key: "income" | "expense" | "balance") =>
    monthlyFlow.map((item, index) => {
      const x = 60 + index * 80;
      const y = 190 - (item[key] - trendMin) / trendRange * 145;
      return `${x},${y}`;
    }).join(" ");
  const trendY = (value: number) => 190 - (value - trendMin) / trendRange * 145;
  const axisTicks = Array.from({ length: 5 }, (_, index) => trendMax - trendRange / 4 * index);
  const yearlyIncome = monthlyFlow.reduce((sum, item) => sum + item.income, 0);
  const yearlyExpense = monthlyFlow.reduce((sum, item) => sum + item.expense, 0);
  const highestIncomeMonth = monthlyFlow.reduce((best, item) => item.income > best.income ? item : best, monthlyFlow[0]);
  const highestExpenseMonth = monthlyFlow.reduce((best, item) => item.expense > best.expense ? item : best, monthlyFlow[0]);
  const cashBalance = selectedSummary.data.find((item) => item.paymentType === "NAKİT")?.balance ?? 0;
  const cashRatio = selectedSummary.totals.balance > 0
    ? Math.max(0, Math.round(cashBalance / selectedSummary.totals.balance * 100))
    : 0;
  return (
    <section className="general-cash-panel">
      <div className="general-cash-title">
        <div>
          <span>FİNANSAL DURUM</span>
          <h2>Genel Kasa Durumu</h2>
          <p>TL ve döviz hesaplarının gelir, gider ve kalan bakiye özeti</p>
        </div>
        <small>Son güncelleme: {formatDate(today)}</small>
      </div>
      <div className="all-cash-overview">
        <div className="all-cash-overview-heading">
          <div>
            <span>TÜM KASALAR</span>
            <h3>Kasa Toplamları</h3>
          </div>
          <small>Kullanılabilir tutar, nakit ve banka bakiyelerinin toplamıdır.</small>
        </div>
        <div className="all-cash-table-wrap">
          <table className="all-cash-table">
            <thead>
              <tr>
                <th>KASA</th>
                <th>PARA BİRİMİ</th>
                <th>TOPLAM TUTAR</th>
                <th>KULLANILABİLİR TUTAR</th>
              </tr>
            </thead>
            <tbody>
              {currencySummaries.map(({ currency, totals, availableBalance }) => (
                <tr key={currency}>
                  <td>
                    <span className={`cash-currency-icon currency-${currency.toLowerCase()}`}>
                      {{ TRY: "₺", USD: "$", EUR: "€" }[currency]}
                    </span>
                    <b>{{ TRY: "Türk Lirası Kasası", USD: "Dolar Kasası", EUR: "Euro Kasası" }[currency]}</b>
                  </td>
                  <td><span className="cash-currency-code">{currency}</span></td>
                  <td>{fmt(totals.balance, currency)}</td>
                  <td><strong>{fmt(availableBalance, currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="summary-card general-cash-summary">
        {currencySummaries.map(({ currency, data, totals, availableBalance }) => (
            <div className="summary-block" key={currency}>
              <div className="currency-heading">
                <span>{{ TRY: "₺", USD: "$", EUR: "€" }[currency]}</span>
                <div><b>{{ TRY: "Türk Lirası Kasası", USD: "Dolar Kasası", EUR: "Euro Kasası" }[currency]}</b><small>{currency}</small></div>
              </div>
              <table className="summary">
                <thead>
                  <tr>
                    <th>ÖDEME TÜRÜ</th>
                    <th>GELİR</th>
                    <th>GİDER</th>
                    <th>KALAN</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.paymentType}>
                      <td>{item.paymentType}</td>
                      <td>{fmt(item.income, currency)}</td>
                      <td>{fmt(item.expense, currency)}</td>
                      <td>{fmt(item.balance, currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="summary-totals">
                  <tr>
                    <td>GENEL TOPLAM</td>
                    <td>{fmt(totals.income, currency)}</td>
                    <td>{fmt(totals.expense, currency)}</td>
                    <td>{fmt(totals.balance, currency)}</td>
                  </tr>
                  <tr className="available-total">
                    <td colSpan={3}>KULLANILABİLİR BAKİYE (NAKİT + BANKA)</td>
                    <td>{fmt(availableBalance, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
        ))}
        <div className="summary-block cash-insight-card">
          <div className="chart-heading">
            <span><BarChart3 /></span>
            <div>
              <b>Kasa Dağılımı</b>
              <small>Eldeki bakiyenin ödeme türlerine dağılımı</small>
            </div>
          </div>
          <div className="chart-currency-tabs">
            {["TRY", "USD", "EUR"].map((currency) => (
              <button key={currency} className={chartCurrency === currency ? "active" : ""} onClick={() => setChartCurrency(currency)}>{currency}</button>
            ))}
          </div>
          <div className="donut-layout">
            <div className="donut-chart" style={{ background: distributionGradient }}>
              <div><small>ELDEKİ</small><strong>{fmt(selectedSummary.totals.balance, chartCurrency)}</strong></div>
            </div>
            <div className="donut-details">
              {selectedSummary.data.map((item, index) => (
                <div key={item.paymentType}>
                  <i style={{ background: chartColors[index] }} />
                  <span>{item.paymentType}<small>{distributionTotal > 0 ? `%${Math.round(Math.max(0, item.balance) / distributionTotal * 100)}` : "%0"}</small></span>
                  <strong>{fmt(item.balance, chartCurrency)}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-kpis">
            <div><small>TOPLAM ALINAN</small><strong>{fmt(selectedSummary.totals.income, chartCurrency)}</strong></div>
            <div><small>TOPLAM VERİLEN</small><strong>{fmt(selectedSummary.totals.expense, chartCurrency)}</strong></div>
            <div><small>KULLANILABİLİR</small><strong>{fmt(selectedSummary.availableBalance, chartCurrency)}</strong></div>
          </div>
        </div>
        <div className="summary-block cash-trend-chart">
          <div className="trend-header">
            <div><b>{chartCurrency} Aylık Finansal Hareket</b><small>{today.slice(0, 4)} yılı gelir, gider ve net bakiye eğilimi</small></div>
            <div className="trend-legend"><span className="income">Gelir</span><span className="expense">Gider</span><span className="balance">Net bakiye</span></div>
          </div>
          <svg viewBox="0 0 1000 225" role="img" aria-label={`${chartCurrency} aylık gelir gider ve bakiye grafiği`}>
            {[45, 81, 117, 153, 189].map((y, index) => <g key={y}><line x1="58" y1={y} x2="950" y2={y} className="grid-line" /><text x="52" y={y + 3} textAnchor="end" className="axis-value">{Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(axisTicks[index])}</text></g>)}
            <polyline points={trendPoints("income")} className="trend-income" />
            <polyline points={trendPoints("expense")} className="trend-expense" />
            <polyline points={trendPoints("balance")} className="trend-balance" />
            {monthlyFlow.flatMap((item, index) => ([
              <circle key={`income-${item.month}`} cx={60 + index * 80} cy={trendY(item.income)} r="4" className="trend-dot income-dot"><title>{`${item.month} gelir: ${fmt(item.income, chartCurrency)}`}</title></circle>,
              <circle key={`expense-${item.month}`} cx={60 + index * 80} cy={trendY(item.expense)} r="4" className="trend-dot expense-dot"><title>{`${item.month} gider: ${fmt(item.expense, chartCurrency)}`}</title></circle>,
              <circle key={`balance-${item.month}`} cx={60 + index * 80} cy={trendY(item.balance)} r="4" className="trend-dot balance-dot"><title>{`${item.month} net: ${fmt(item.balance, chartCurrency)}`}</title></circle>,
            ]))}
            {monthlyFlow.map((item, index) => <text key={item.month} x={60 + index * 80} y="216" textAnchor="middle">{item.month}</text>)}
          </svg>
          <div className="trend-summary">
            <span>Yıllık gelir <b>{fmt(yearlyIncome, chartCurrency)}</b></span>
            <span>Yıllık gider <b>{fmt(yearlyExpense, chartCurrency)}</b></span>
            <span>Net hareket <b>{fmt(runningBalance, chartCurrency)}</b></span>
          </div>
          <div className="financial-insights">
            <div><small>EN YÜKSEK GELİR AYI</small><b>{highestIncomeMonth.month}</b><strong>{fmt(highestIncomeMonth.income, chartCurrency)}</strong></div>
            <div><small>EN YÜKSEK GİDER AYI</small><b>{highestExpenseMonth.month}</b><strong>{fmt(highestExpenseMonth.expense, chartCurrency)}</strong></div>
            <div><small>NAKİT ORANI</small><b>%{cashRatio}</b><strong>Toplam bakiyedeki payı</strong></div>
            <div className={runningBalance >= 0 ? "positive" : "negative"}><small>YILLIK DURUM</small><b>{runningBalance >= 0 ? "KÂR" : "ZARAR"}</b><strong>{fmt(runningBalance, chartCurrency)}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CashOut({ plans, rows, openPay }: { plans: Plan[]; rows: Row[]; openPay: (plan: Plan) => void }) {
  const [units, setUnits] = useState(paymentUnitsSeed);
  const emptyQuery = {
    company: "TÜMÜ",
    year: "TÜMÜ",
    month: "TÜMÜ",
    currency: "TÜMÜ",
    status: "TÜMÜ",
    startDate: "",
    endDate: "",
  };
  const [query, setQuery] = useState(emptyQuery);
  const [appliedQuery, setAppliedQuery] = useState<typeof emptyQuery>({ ...emptyQuery });
  useEffect(() => {
    try {
      if (localStorage.getItem("mks-payment-units-version") === "planning-catalog-2026-09-30") {
        const saved = JSON.parse(localStorage.getItem("mks-payment-units") ?? "null");
        setUnits(completePaymentUnits(saved));
      }
    } catch { /* Use the existing company list when storage cannot be read. */ }
  }, []);
  const companies = Array.from(new Set([...partnerNames, ...plans.map((plan) => plan.company)]))
    .sort((a, b) => a.localeCompare(b, "tr-TR"));
  const options = (values: string[]) => ["TÜMÜ", ...Array.from(new Set(values.filter(Boolean))).sort()];
  const updateQuery = (key: keyof typeof emptyQuery, value: string) => setQuery((current) => ({ ...current, [key]: value }));
  const visible = plans.filter((plan) => {
    const status = planStatus(plan.amount, plan.paid);
    return (appliedQuery.company === "TÜMÜ" || plan.company === appliedQuery.company)
      && (appliedQuery.year === "TÜMÜ" || plan.year === appliedQuery.year)
      && (appliedQuery.month === "TÜMÜ" || plan.month === appliedQuery.month)
      && (appliedQuery.currency === "TÜMÜ" || plan.currency === appliedQuery.currency)
      && (appliedQuery.status === "TÜMÜ" || status === appliedQuery.status)
      && (!appliedQuery.startDate || plan.due >= appliedQuery.startDate)
      && (!appliedQuery.endDate || plan.due <= appliedQuery.endDate);
  }).sort((a, b) => b.due.localeCompare(a.due));
  const currencyVisible = visible;
  return (
    <section className="cash-out-panel">
      <div className="cash-out-heading">
        <div><span>KASA ÇIKIŞ</span><h2>Ödeme Planı Sorgulama</h2><p>Ödeme yapılacak firmaları ve planları tablo alanlarına göre sorgulayın.</p></div>
        <div className="cash-out-result-badge"><Search /><span>{currencyVisible.length} sonuç</span></div>
      </div>
      <div className="cash-out-query-card">
        <div className="cash-out-query-title"><Filter /><div><b>Sorgu Kriterleri</b><small>Bir veya birden fazla alan seçebilirsiniz.</small></div></div>
        <div className="cash-out-filters">
          <Field l="ŞUBE"><div className="fixed-value">{branch}</div></Field>
          <Field l="ÖDEME YAPILACAK FİRMA"><Select v={query.company} set={(value) => updateQuery("company", value)} o={["TÜMÜ", ...companies]} /></Field>
          <Field l="YIL"><Select v={query.year} set={(value) => updateQuery("year", value)} o={options(plans.map((plan) => plan.year))} /></Field>
          <Field l="AY"><Select v={query.month} set={(value) => updateQuery("month", value)} o={options(plans.map((plan) => plan.month))} /></Field>
          <Field l="PARA BİRİMİ"><Select v={query.currency} set={(value) => updateQuery("currency", value)} o={options(plans.map((plan) => plan.currency))} /></Field>
          <Field l="ÖDEME DURUMU"><Select v={query.status} set={(value) => updateQuery("status", value)} o={["TÜMÜ", "ÖDENMEDİ", "KISMİ", "ÖDENDİ"]} /></Field>
          <Field l="SON ÖDEME BAŞLANGIÇ"><TurkishDateInput value={query.startDate} setValue={(value) => updateQuery("startDate", value)} /></Field>
          <Field l="SON ÖDEME BİTİŞ"><TurkishDateInput value={query.endDate} setValue={(value) => updateQuery("endDate", value)} /></Field>
        </div>
        <div className="cash-out-query-actions">
          <button className="cash-out-clear" onClick={() => { setQuery(emptyQuery); setAppliedQuery({ ...emptyQuery }); }}>Filtreleri Temizle</button>
          <button className="cash-out-search" onClick={() => setAppliedQuery({ ...query })}><Search /> Sorgula</button>
        </div>
      </div>
      <div className="cash-out-table-wrap">
        <table className="cash-out-table">
          <thead><tr>{["İşlem", "Planlanan Grup", "Planlanan Tür / Firma", "Kasa / Hesap", "Giriş Tarihi", "Son Ödeme Tarihi", "Ödenen Tarih", "Yıl", "Ay", "Planlanan Tutar", "Ödenen", "Kalan", "Durum"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{currencyVisible.length ? currencyVisible.map((plan) => {
            const remaining = Math.max(0, Math.round((plan.amount - plan.paid) * 100) / 100);
            const paid = planStatus(plan.amount, plan.paid) === "ÖDENDİ";
            const transactionDate = rows
              .filter((row) => row.planId === plan.id && isValidIsoDate(row.date))
              .map((row) => row.date)
              .sort()
              .at(-1);
            const lastPayment = plan.paid > 0
              ? transactionDate
                ?? (isValidIsoDate(plan.lastPaidDate) ? plan.lastPaidDate : undefined)
                ?? (isValidIsoDate(plan.invoiceDate) ? plan.invoiceDate : undefined)
                ?? (isValidIsoDate(plan.due) ? plan.due : undefined)
              : undefined;
            return <tr key={plan.id}>
              <td><button className="cash-out-pay" disabled={paid || remaining <= 0} title={paid ? "Bu ödeme tamamlandı" : "Ödeme formunu aç"} onClick={() => { if (!paid && remaining > 0) openPay(plan); }}>Ödeme Yap »</button></td>
              <td>{plan.type}</td><td>{plan.company}</td><td>{plan.account || "—"}</td><td>{formatDate(plan.entryDate ?? plan.invoiceDate)}</td>
              <td>{formatDate(plan.due)}</td><td>{formatDate(lastPayment) || "—"}</td><td>{plan.year}</td><td>{plan.month}</td>
              <td>{fmt(plan.amount, plan.currency)}</td><td>{fmt(plan.paid, plan.currency)}</td><td>{fmt(remaining, plan.currency)}</td>
              <td><span className={paid ? "payment-state paid" : "payment-state pending"}>{planStatus(plan.amount, plan.paid)}</span></td>
            </tr>;
          }) : <tr><td colSpan={13} className="none">Sorgu kriterlerine uygun ödeme planı bulunamadı.</td></tr>}</tbody>
          {currencyVisible.length ? <tfoot><tr className="table-total"><td colSpan={9}>TOPLAM</td><td>{totalsByCurrency(currencyVisible, (plan) => plan.amount, (plan) => plan.currency)}</td><td>{totalsByCurrency(currencyVisible, (plan) => plan.paid, (plan) => plan.currency)}</td><td>{totalsByCurrency(currencyVisible, (plan) => Math.max(0, plan.amount - plan.paid), (plan) => plan.currency)}</td><td /></tr></tfoot> : null}
        </table>
      </div>
      <small className="cash-out-count">{currencyVisible.length} ödeme planı gösteriliyor</small>
    </section>
  );
}

function CashPage({
  type,
  rows,
  setRows,
}: {
  type: Exclude<Page, "home" | "planning" | ReportPage>;
  rows: Row[];
  setRows: (r: Row[]) => void;
}) {
  const isIn = type === "cash-in",
    virman = type === "transfer" || type === "currency";
  const [f, setF] = useState({
      date: today,
      movement: "--Seçiniz--",
      payment: "--Seçiniz--",
      account: "Merkez Nakit Kasa",
      received: "--Seçiniz--",
      sent: "--Seçiniz--",
      rate: "",
      amount: "",
      paid: "",
      currency: type === "currency" ? "TRY" : "TRY",
      targetCurrency: type === "currency" ? "DOLAR" : "EURO",
      debtName: "",
      note: "",
    }),
    u = (k: string, v: string) => setF((current) => {
      const next = { ...current, [k]: v };
      if (type === "currency" && (k === "rate" || k === "amount")) {
        next.paid = next.rate && next.amount
          ? String(Math.round(Number(next.rate) * Number(next.amount) * 100) / 100)
          : "";
      }
      return next;
    });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [rateStatus, setRateStatus] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const currencyTargets: Record<string, string[]> = {
    TRY: ["DOLAR", "EURO"],
    DOLAR: ["TL", "EURO"],
    EURO: ["TL", "DOLAR"],
  };
  const toFormCurrency = (currency?: string) => ({ USD: "DOLAR", EUR: "EURO" })[currency ?? ""] ?? currency ?? "TRY";
  const targetCurrencyOptions = currencyTargets[toFormCurrency(f.currency)] ?? ["DOLAR", "EURO"];
  const loadCurrentRate = useCallback(async (from: string, to: string) => {
    if (type !== "currency") return;
    setRateLoading(true);
    setRateStatus("TCMB güncel kuru alınıyor…");
    try {
      const response = await fetch(`/api/exchange-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const data = await response.json() as { rate?: number; source?: string; date?: string; error?: string };
      if (!response.ok || !data.rate) throw new Error(data.error || "Güncel kur alınamadı.");
      setF((current) => ({
        ...current,
        rate: String(data.rate),
        paid: current.amount
          ? String(Math.round(data.rate! * Number(current.amount) * 100) / 100)
          : "",
      }));
      setRateStatus(`${data.source} güncel kuru (${formatDate(data.date)})`);
    } catch (error) {
      setRateStatus(error instanceof Error ? error.message : "Güncel kur alınamadı; kuru elle girebilirsiniz.");
    } finally {
      setRateLoading(false);
    }
  }, [type]);
  useEffect(() => {
    if (type !== "currency") return;
    void loadCurrentRate(f.currency, f.targetCurrency);
  }, [type, f.currency, f.targetCurrency, loadCurrentRate]);
  const automaticCashInAccount = () => {
    const currency = currencyCode(f.currency);
    if (f.payment === "BANKA") {
      return accounts.find((account) => account.currency === currency && account.type === "BANKA")?.name
        ?? `${currency} Banka Hesabı`;
    }
    if (f.payment === "NAKİT" || f.payment === "--Seçiniz--") {
      return accounts.find((account) => account.currency === currency && account.type === "NAKİT")?.name
        ?? `${currency} Nakit Kasa`;
    }
    return `${f.payment} ${currency} Hesabı`;
  };
  const currencyDescription = `1 ${f.currency} = ${f.rate || "0"} ${f.targetCurrency} KURUNDAN ${f.amount || "0"} ${f.currency}, ${f.paid || "0"} ${f.targetCurrency} PARA BİRİMİNE ÇEVRİLMİŞTİR.`;
  const add = () => {
    const amount = Number(type === "currency" ? f.amount : virman ? f.paid || f.amount : f.amount);
    const missingPayment = virman
      ? f.sent === "--Seçiniz--" || f.received === "--Seçiniz--"
      : f.payment === "--Seçiniz--";
    if (!virman && f.movement === "--Seçiniz--") {
      setFormError("Lütfen hareket türünü seçin.");
      return;
    }
    if (missingPayment) {
      setFormError(
        virman
          ? "Gönderen ve alıcı ödeme türlerini seçin."
          : "Lütfen ödeme türünü seçin.",
      );
      return;
    }
    if (type === "currency" && Number(f.rate) <= 0) {
      setFormError("Döviz kuru sıfırdan büyük olmalıdır.");
      return;
    }
    if (type === "currency" && Number(f.amount) <= 0) {
      setFormError("Alınan tutar sıfırdan büyük olmalıdır.");
      return;
    }
    if (!f.date) {
      setFormError("İşlem tarihini seçin.");
      return;
    }
    if (type === "currency" && f.currency === f.targetCurrency) {
      setFormError("Döviz virmanında alınan ve ödenen para birimleri farklı olmalıdır.");
      return;
    }
    if (type === "transfer" && f.sent === f.received) {
      setFormError("Gönderen ve alan ödeme türleri farklı olmalıdır.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Tutar sıfırdan büyük olmalıdır.");
      return;
    }
    setFormError("");
    setRows([
        {
          id: editingId ?? createNumericId(),
          kind: type,
          movementType: f.movement,
          recordDate: rows.find((row) => row.id === editingId)?.recordDate ?? today,
          rate: type === "currency" ? Number(f.rate) : undefined,
          date: f.date,
          movement: isIn ? f.movement : virman ? "VİRMAN" : "ÇIKIŞ",
          payment: virman
            ? f.sent === "--Seçiniz--"
              ? "NAKİT"
              : f.sent
            : f.payment === "--Seçiniz--"
              ? "NAKİT"
              : f.payment,
          account: isIn ? automaticCashInAccount() : f.account,
          amount,
          currency: f.currency,
          debtName: isIn ? f.debtName.trim() : undefined,
          note:
            type === "currency"
              ? currencyDescription
              : f.note || title(type),
          ...(virman
            ? {
                targetPayment:
                  f.received === "--Seçiniz--" ? "NAKİT" : f.received,
                targetAmount: type === "currency" ? Number(f.paid) : amount,
                targetCurrency: type === "currency" ? f.targetCurrency : f.currency,
              }
            : {}),
        },
        ...rows.filter((row) => row.id !== editingId),
      ]);
    setEditingId(null);
    setF((current) => ({ ...current, amount: "", paid: "", debtName: "", note: "" }));
  };
  const shown = rows.filter((r) => {
    const kind = r.kind ?? (r.movement === "ÇIKIŞ" ? "cash-out" : r.movement === "VİRMAN"
      ? (r.targetCurrency && r.targetCurrency !== r.currency ? "currency" : "transfer") : "cash-in");
    return kind === type;
  });
  const edit = (row: Row) => {
    setEditingId(row.id);
    setF({ date: row.date, movement: row.movementType ?? row.movement,
      payment: row.payment, account: row.account, received: row.targetPayment ?? "--Seçiniz--",
      sent: row.payment, rate: String(row.rate ?? (row.targetAmount ? row.targetAmount / row.amount : 0)),
      amount: String(row.amount), paid: String(type === "currency" ? row.targetAmount ?? 0 : row.amount),
      currency: toFormCurrency(row.currency),
      targetCurrency: type === "currency" ? toFormCurrency(row.targetCurrency ?? "EURO") : "EURO", debtName: row.debtName ?? "", note: row.note });
    document.querySelector(".entry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <div className="form-list">
        <section className="entry">
          <Fixed hideBranch={isIn} />
          {virman ? (
            <>
              <Field l="İŞLEM TARİHİ">
                <TurkishDateInput value={f.date} setValue={(value) => u("date", value)} />
              </Field>
              <Field l="GÖNDEREN ÖDEME TÜRÜ">
                <Select
                  v={f.sent}
                  set={(v) => u("sent", v)}
                  o={paymentTypes}
                />
              </Field>
              <Field l="ALAN ÖDEME TÜRÜ">
                <Select
                  v={f.received}
                  set={(v) => u("received", v)}
                  o={paymentTypes}
                />
              </Field>
              {type === "currency" && (
                <>
                  <div className="dual">
                    <Field l="GÖNDEREN PARA BİRİMİ">
                      <Select
                        v={f.currency}
                        set={(v) => setF((current) => ({ ...current, currency: v, targetCurrency: currencyTargets[v][0], rate: "", paid: "" }))}
                        o={currencyTypes}
                      />
                    </Field>
                    <b>⇄</b>
                    <Field l="ALAN PARA BİRİMİ">
                      <Select
                        key={`target-${f.currency}`}
                        v={f.targetCurrency}
                        set={(v) => setF((current) => ({ ...current, targetCurrency: v, rate: "", paid: "" }))}
                        o={targetCurrencyOptions}
                      />
                      <div className="currency-target-options">
                        {targetCurrencyOptions.map((currency) => (
                          <button
                            type="button"
                            className={f.targetCurrency === currency ? "active" : ""}
                            key={currency}
                            onClick={() => setF((current) => ({ ...current, targetCurrency: currency, rate: "", paid: "" }))}
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <Field l="GÜNCEL / MANUEL KUR">
                    <div className="rate-input-row">
                      <input
                        type="number"
                        step="0.000001"
                        value={f.rate}
                        onChange={(e) => { u("rate", e.target.value); setRateStatus("Kur elle girildi."); }}
                      />
                      <button type="button" onClick={() => void loadCurrentRate(f.currency, f.targetCurrency)} disabled={rateLoading}>{rateLoading ? "Alınıyor…" : "Güncel Kuru Getir"}</button>
                    </div>
                    {rateStatus ? <small className="rate-status">{rateStatus}</small> : null}
                  </Field>
                  <Field l="GÖNDERİLEN TUTAR">
                    <input
                      type="number"
                      value={f.amount}
                      onChange={(e) => u("amount", e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field l={type === "currency" ? "ALINAN TUTAR" : "GÖNDERİLEN TUTAR"}>
                <input
                  type="number"
                  value={f.paid}
                  onChange={(e) => type === "currency" ? undefined : u("paid", e.target.value)}
                  readOnly={type === "currency"}
                />
              </Field>
            </>
          ) : (
            <>
              <Field l="İŞLEM TARİHİ">
                <TurkishDateInput value={f.date} setValue={(value) => u("date", value)} />
              </Field>
              <Field l="HAREKET TÜRÜ">
                <Select
                  v={f.movement}
                  set={(v) => u("movement", v)}
                  o={movementTypes}
                />
              </Field>
              <Field l="ÖDEME TÜRÜ">
                <Select
                  v={f.payment}
                  set={(v) => u("payment", v)}
                  o={paymentTypes}
                />
              </Field>
              <Field l="TUTAR">
                <input
                  type="number"
                  value={f.amount}
                  onChange={(e) => u("amount", e.target.value)}
                />
              </Field>
              {isIn ? (
                <Field l="BORCUN ADI">
                  <input
                    value={f.debtName}
                    onChange={(event) => u("debtName", event.target.value)}
                    placeholder="Borcun adını girin"
                  />
                </Field>
              ) : null}
            </>
          )}
          {type !== "currency" ? (
            <Field l="PARA BİRİMİ">
              <Select
                v={f.currency}
                set={(v) => u("currency", v)}
                o={currencyTypes}
              />
            </Field>
          ) : null}
          <Field l="AÇIKLAMA">
            <textarea
              value={type === "currency" ? currencyDescription : f.note}
              onChange={(e) => u("note", e.target.value)}
              readOnly={type === "currency"}
              aria-label={
                type === "currency"
                  ? "Otomatik oluşturulan açıklama"
                  : "Açıklama"
              }
            />
          </Field>
          {formError ? (
            <div className="form-error" role="alert">
              {formError}
            </div>
          ) : null}
          <button className="add" onClick={add}>
            {editingId === null ? "Ekle" : "Değişiklikleri Kaydet"}
          </button>
          {editingId !== null && <button onClick={() => setEditingId(null)}>Düzenlemeyi iptal et</button>}
        </section>
        <List
          title={
            type === "transfer"
              ? "ÖDEME TÜRÜ KASA VİRMAN LİSTESİ"
              : type === "currency"
                ? "KASA VİRMAN LİSTESİ"
                : isIn
                  ? "KASA GİRİŞ LİSTESİ"
                  : "KASA ÇIKIŞ LİSTESİ"
          }
          rows={shown}
          all={rows}
          setRows={setRows}
          onEdit={edit}
          type={type}
        />
      </div>
    </>
  );
}

function CashPosition({ rows }: { rows: Row[] }) {
  const balances = accounts.map((account) => {
    const movementTotal = rows
      .filter(
        (row) =>
          row.account === account.name &&
          row.currency === account.currency &&
          row.movement !== "VİRMAN",
      )
      .reduce(
        (total, row) =>
          total + (row.movement === "ÇIKIŞ" ? -row.amount : row.amount),
        0,
      );
    const balance = account.opening + movementTotal;
    const liquid = account.type === "NAKİT" || account.type === "BANKA";
    return { ...account, balance, usable: liquid ? balance - account.reserved : 0 };
  });
  const tryAccounts = balances.filter((account) => account.currency === "TRY");
  const total = tryAccounts.reduce((sum, account) => sum + account.balance, 0);
  const reserved = tryAccounts.reduce(
    (sum, account) => sum + account.reserved,
    0,
  );
  const available = tryAccounts.reduce((sum, account) => sum + account.usable, 0);
  return (
    <section className="cash-position">
      <div className="cash-position-title">
        <div>
          <h2>KASA VE HESAP DURUMU</h2>
          <p>Nakit kasalar, açık banka hesapları ve kullanılabilir bakiyeler</p>
        </div>
        <span>Son güncelleme: 02.09.2026</span>
      </div>
      <div className="balance-cards">
        <div>
          <small>TOPLAM KASA</small>
          <strong>{fmt(total)}</strong>
          <em>Tüm TL hesapları</em>
        </div>
        <div className="waiting">
          <small>ÖDEME BEKLİYOR</small>
          <strong>{fmt(reserved)}</strong>
          <em>Planlara ayrılan tutar</em>
        </div>
        <div className="blocked">
          <small>KULLANILAMAYAN</small>
          <strong>{fmt(reserved)}</strong>
          <em>Bloke / ayrılmış bakiye</em>
        </div>
        <div className="available">
          <small>KULLANILABİLİR KASA</small>
          <strong>{fmt(available)}</strong>
          <em>Serbest kullanılabilir bakiye</em>
        </div>
      </div>
      <div className="scroll">
        <table className="account-table">
          <thead>
            <tr>
              <th>KASA / HESAP</th>
              <th>HESAP TÜRÜ</th>
              <th>PARA BİRİMİ</th>
              <th>TOPLAM BAKİYE</th>
              <th>ÖDEME BEKLEYEN</th>
              <th>KULLANILAMAYAN</th>
              <th>KULLANILABİLİR</th>
              <th>DURUM</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((account) => (
              <tr key={account.name}>
                <td>
                  <b>{account.name}</b>
                </td>
                <td>{account.type}</td>
                <td>{account.currency}</td>
                <td>{fmt(account.balance, account.currency)}</td>
                <td className="reserved">
                  {fmt(account.reserved, account.currency)}
                </td>
                <td>{fmt(account.reserved, account.currency)}</td>
                <td className="usable">
                  {fmt(account.usable, account.currency)}
                </td>
                <td>
                  <span className="open-account">AÇIK</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="table-total">
              <td colSpan={3}>TOPLAM</td>
              <td>{totalsByCurrency(balances, (account) => account.balance, (account) => account.currency)}</td>
              <td>{totalsByCurrency(balances, (account) => account.reserved, (account) => account.currency)}</td>
              <td>{totalsByCurrency(balances, (account) => account.reserved, (account) => account.currency)}</td>
              <td>{totalsByCurrency(balances, (account) => account.usable, (account) => account.currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
function Fixed({ hideBranch = false }: { hideBranch?: boolean }) {
  return (
    <>
      {!hideBranch ? (
        <Field l="ŞUBE">
          <Select v={branch} set={() => {}} o={[branch]} />
        </Field>
      ) : null}
      <Field l="İŞLEM YAPAN">
        <Select v="ARAFAT ŞİMŞEK" set={() => {}} o={["ARAFAT ŞİMŞEK"]} />
      </Field>
      <Field l="YIL">
        <input value={today.slice(0, 4)} readOnly />
      </Field>
      <Field l="KAYIT TARİHİ">
        <input value={formatDate(today)} readOnly />
      </Field>
    </>
  );
}
function List({
  title,
  rows,
  all,
  setRows,
  onEdit,
  type,
}: {
  title: string;
  rows: Row[];
  all: Row[];
  setRows: (r: Row[]) => void;
  onEdit: (row: Row) => void;
  type: string;
}) {
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const emptyFilters = {
    year: "--Seçiniz--",
    month: "--Seçiniz--",
    recordDate: "",
    collectionDate: "",
    movement: "--Seçiniz--",
    payment: "--Seçiniz--",
    currency: "--Seçiniz--",
  };
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const monthNumber: Record<string, string> = {
    OCAK: "01",
    ŞUBAT: "02",
    MART: "03",
    NİSAN: "04",
    MAYIS: "05",
    HAZİRAN: "06",
    TEMMUZ: "07",
    AĞUSTOS: "08",
    EYLÜL: "09",
    EKİM: "10",
    KASIM: "11",
    ARALIK: "12",
  };
  const shown = rows.filter((row) => {
    const searchable = `${row.debtName ?? ""} ${row.note} ${row.payment} ${row.movement} ${row.account} ${row.currency}`.toLowerCase();
    if (!searchable.includes(q.toLowerCase())) return false;
    if (appliedFilters.year !== "--Seçiniz--" && !row.date.startsWith(appliedFilters.year)) return false;
    if (
      appliedFilters.month !== "--Seçiniz--" &&
      row.date.slice(5, 7) !== monthNumber[appliedFilters.month]
    ) return false;
    if (appliedFilters.recordDate && (row.recordDate ?? today) !== appliedFilters.recordDate) return false;
    if (appliedFilters.collectionDate && row.date !== appliedFilters.collectionDate) return false;
    if (appliedFilters.movement !== "--Seçiniz--" && (row.movementType ?? row.movement) !== appliedFilters.movement) return false;
    if (appliedFilters.payment !== "--Seçiniz--" && row.payment !== appliedFilters.payment && row.targetPayment !== appliedFilters.payment) return false;
    if (appliedFilters.currency !== "--Seçiniz--" && currencyCode(row.currency) !== appliedFilters.currency) return false;
    return true;
  });
  const currencyRows = shown;
  return (
    <section className="list">
      <h2>{title}</h2>
      <div className="query">
        <h3>Sorgulama</h3>
        <div className="query-grid">
          <Field l="ŞUBE">
            <div className="fixed-value">{branch}</div>
          </Field>
          <Field l="YILLIK">
            <Select
              v={filters.year}
              set={(value) => setFilter("year", value)}
              o={["--Seçiniz--", "2025", "2026", "2027"]}
            />
          </Field>
          <Field l="AYLIK">
            <Select
              v={filters.month}
              set={(value) => setFilter("month", value)}
              o={["--Seçiniz--", ...Object.keys(monthNumber)]}
            />
          </Field>
          <Field l="KAYIT TARİHİ (GÜNLÜK)">
            <TurkishDateInput value={filters.recordDate} setValue={(value) => setFilter("recordDate", value)} />
          </Field>
          <Field l="TAHSİLAT TARİHİ (GÜNLÜK)">
            <TurkishDateInput value={filters.collectionDate} setValue={(value) => setFilter("collectionDate", value)} />
          </Field>
          {type !== "transfer" && <Field l="HAREKET TÜRÜ">
            <Select
              v={filters.movement}
              set={(value) => setFilter("movement", value)}
              o={type === "currency" ? ["--Seçiniz--", "VİRMAN"] : movementTypes}
            />
          </Field>}
          <Field l="ÖDEME TÜRÜ">
            <Select
              v={filters.payment}
              set={(value) => setFilter("payment", value)}
              o={paymentTypes}
            />
          </Field>
          <Field l="PARA BİRİMİ">
            <Select
              v={filters.currency}
              set={(value) => setFilter("currency", value)}
              o={["--Seçiniz--", "TRY", "USD", "EUR"]}
            />
          </Field>
          <button
            className="search"
            type="button"
            onClick={() => setAppliedFilters({ ...filters })}
          >
            Sorgula
          </button>
        </div>
      </div>
      <Tools q={q} setQ={(value) => { setQ(value); setPage(1); }} pageSize={pageSize} setPageSize={(value) => { setPageSize(value); setPage(1); }} rows={currencyRows} />
      <div className="scroll">
        <table className="records">
          <thead>
            <tr>
              <th>GÜNCELLE</th>
              <th>SİL</th>
              <th>İŞLEM TARİHİ</th>
              {type !== "cash-in" ? <th>ŞUBE</th> : null}
              <th>HAREKET TÜRÜ</th>
              <th>ÖDEME TÜRÜ</th>
              {type !== "cash-in" ? <th>{type === "currency" ? "ALINAN TUTAR / BİRİM" : type === "transfer" ? "ALAN ÖDEME TÜRÜ" : "KASA / BANKA HESABI"}</th> : null}
              <th>TUTAR</th>
              <th>PARA BİRİMİ</th>
              <th>KAYIT TARİHİ</th>
              {type === "cash-in" ? <th>BORCUN ADI</th> : null}
              <th>AÇIKLAMA</th>
            </tr>
          </thead>
          <tbody>
            {currencyRows.length ? (
              currencyRows.slice((Math.min(page, Math.max(1, Math.ceil(currencyRows.length / pageSize))) - 1) * pageSize, Math.min(page, Math.max(1, Math.ceil(currencyRows.length / pageSize))) * pageSize).map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="mini blue" onClick={() => onEdit(r)}>Güncelle</button>
                  </td>
                  <td>
                    <button
                      className="mini red"
                      onClick={() => setRows(all.filter((x) => x.id !== r.id))}
                    >
                      Sil
                    </button>
                  </td>
                  <td>{formatDate(r.date)}</td>
                  {type !== "cash-in" ? <td>{branch}</td> : null}
                  <td>{r.movementType && r.movementType !== "--Seçiniz--" ? r.movementType : r.movement}</td>
                  <td>{r.payment}{type === "currency" && r.targetPayment ? ` → ${r.targetPayment}` : ""}</td>
                  {type !== "cash-in" ? <td>{type === "currency" ? `${r.targetAmount} ${r.targetCurrency}` : type === "transfer" ? r.targetPayment : r.account}</td> : null}
                  <td>{r.amount.toFixed(2)}</td>
                  <td>{r.currency}</td>
                  <td>{formatDate(r.recordDate ?? today)}</td>
                  {type === "cash-in" ? <td>{r.debtName || "—"}</td> : null}
                  <td>{r.note}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={type === "cash-in" ? 10 : 11} className="none">
                  Tablo boş
                  <br />
                  <small>Gösterilecek hiç kayıt yok.</small>
                </td>
              </tr>
            )}
          </tbody>
          {currencyRows.length ? (
            <tfoot>
              <tr className="table-total">
                <td colSpan={type === "cash-in" ? 5 : 7}>TOPLAM</td>
                <td>{totalsByCurrency(currencyRows, (row) => row.amount, (row) => row.currency)}</td>
                <td colSpan={type === "cash-in" ? 4 : 3} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="pager">
        <button disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>Önceki</button>
        <b>{Math.min(page, Math.max(1, Math.ceil(currencyRows.length / pageSize)))} / {Math.max(1, Math.ceil(currencyRows.length / pageSize))}</b>
        <button disabled={page >= Math.ceil(currencyRows.length / pageSize)} onClick={() => setPage(page + 1)}>Sonraki</button>
      </div>
    </section>
  );
}
function Tools({ q, setQ, pageSize, setPageSize, rows }: { q: string; setQ: (v: string) => void; pageSize: number; setPageSize: (value: number) => void; rows: Row[] }) {
  const [message, setMessage] = useState("");
  const data = [["İşlem Tarihi", "Şube", "Hareket Türü", "Gönderen Ödeme", "Alan Ödeme", "Hesap", "Tutar", "Para Birimi", "Alınan Tutar", "Alınan Para Birimi", "Kayıt Tarihi", "Borcun Adı", "Açıklama"], ...rows.map((row) => [formatDate(row.date), branch, row.movementType ?? row.movement, row.payment, row.targetPayment ?? "", row.account, row.amount, row.currency, row.targetAmount ?? "", row.targetCurrency ?? "", formatDate(row.recordDate ?? today), row.debtName ?? "", row.note])];
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.map((row) => row.join("\t")).join("\n")); setMessage("Kayıtlar kopyalandı."); }
    catch { setMessage("Tarayıcı panoya erişim izni vermedi."); }
  };
  const download = () => {
    const csv = "\uFEFF" + data.map((row) => row.map((value) => {
      const text = String(value);
      return '"' + (/^[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
    }).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "mks-kasa-kayitlari.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Excel uyumlu CSV indirildi.");
  };
  return (
    <div className="tools">
      <select aria-label="Sayfa başına kayıt" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>Göster ({size}) Kayıt</option>)}</select>
      <button onClick={copy}>Kopyala</button>
      <button onClick={download}>
        <FileSpreadsheet /> Excel
      </button>
      <button onClick={() => window.print()}>
        <Printer /> Yazdır
      </button>
      <label>
        Arama: <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

function Planning({
  plans,
  setPlans,
  openPay,
}: {
  plans: Plan[];
  setPlans: (p: Plan[]) => void;
  openPay: (p: Plan) => void;
}) {
  const [planShow, setPlanShow] = useState(false);
  const [unitShow, setUnitShow] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingUnit, setEditingUnit] = useState<PaymentUnit | null>(null);
  const [planCompany, setPlanCompany] = useState<string | null>(null);
  const [units, setUnits] = useState<PaymentUnit[]>(paymentUnitsSeed);
  const [unitsReady, setUnitsReady] = useState(false);
  useEffect(() => {
    const catalogVersion = "planning-catalog-2026-09-30";
    if (localStorage.getItem("mks-payment-units-version") === catalogVersion) {
      const saved = localStorage.getItem("mks-payment-units");
      if (saved) {
        try { setUnits(completePaymentUnits(JSON.parse(saved))); } catch { setUnits(paymentUnitsSeed); }
      }
    } else {
      setUnits(paymentUnitsSeed);
      localStorage.setItem("mks-payment-units", JSON.stringify(paymentUnitsSeed));
      localStorage.setItem("mks-payment-units-version", catalogVersion);
    }
    setUnitsReady(true);
  }, []);
  useEffect(() => {
    if (unitsReady) localStorage.setItem("mks-payment-units", JSON.stringify(units));
  }, [units, unitsReady]);
  const [plannedGroup, setPlannedGroup] = useState("PARTNER");
  const [plannedType, setPlannedType] = useState("TÜMÜ");
  const [unitStatus, setUnitStatus] = useState("TÜMÜ");
  const [unitSearch, setUnitSearch] = useState("");
  const [firm, setFirm] = useState("BERR GLOBAL");
  const [yearFilter, setYearFilter] = useState("--Seçiniz--");
  const [monthFilter, setMonthFilter] = useState("--Seçiniz--");
  const [currencyFilter, setCurrencyFilter] = useState("--Seçiniz--");
  const [orderFilter, setOrderFilter] = useState("--Seçiniz--");
  const [selectedPlans, setSelectedPlans] = useState<number[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [showPlanArchive, setShowPlanArchive] = useState(false);
  const companies = planningGroupTypes[plannedGroup] ?? [];
  const visibleUnits = units.filter(
    (unit) =>
      unit.group === plannedGroup &&
      (plannedType === "TÜMÜ" || unit.name === plannedType) &&
      (unitStatus === "TÜMÜ" || unit.status === unitStatus) &&
      `${unit.name} ${unit.country} ${unit.region}`
        .toLocaleLowerCase("tr-TR")
        .includes(unitSearch.toLocaleLowerCase("tr-TR")),
  );
  const filtered = plans.filter(
    (plan) =>
      currencyFilter !== "--Seçiniz--" &&
      plan.company === firm &&
      (yearFilter === "--Seçiniz--" || plan.year === yearFilter) &&
      (monthFilter === "--Seçiniz--" || plan.month === monthFilter) &&
      currencyCode(plan.currency) === currencyFilter &&
      (orderFilter === "--Seçiniz--" || plan.order === orderFilter),
  );
  const savePlan = (data: PlanInput) => {
    if (editingPlan) {
      setPlans(
        plans.map((plan) => {
          if (plan.id !== editingPlan.id) return plan;
          const paid = Math.min(plan.paid, data.amount);
          return {
            ...plan,
            ...data,
            paid,
            payment: planStatus(data.amount, paid),
          };
        }),
      );
      setEditingPlan(null);
    } else {
      setPlans([
        {
          id: createNumericId(),
          paid: 0,
          payment: "ÖDENMEDİ",
          ...data,
        },
        ...plans,
      ]);
    }
    setPlanShow(false);
  };
  return (
    <>
      <div className="planning-hero"><div><span>Kasa › Firma Ödeme Planlama</span><h1>Firma ve ödeme planları</h1><p>Ödeme birimlerini yönetin, plan oluşturun ve gerçekleşen ödemeleri kolayca izleyin.</p></div><aside>Finansı<br />bugünden planla,<br />yarına güvenle ilerle.</aside></div>
      <div className="planning-metrics">
        {[{ label: "Toplam Planlanan Ödeme", icon: <Coins />, values: plans.map((p) => ({ currency: p.currency, amount: p.amount })) }, { label: "Gerçekleşen Ödeme", icon: <Wallet />, values: plans.map((p) => ({ currency: p.currency, amount: p.paid })) }, { label: "Bekleyen Ödeme", icon: <Clock3 />, values: plans.map((p) => ({ currency: p.currency, amount: Math.max(0, p.amount - p.paid) })) }].map((metric) => <article key={metric.label}><span className="metric-icon">{metric.icon}</span><div><small>{metric.label}</small>{Array.from(new Set(metric.values.map((v) => currencyCode(v.currency)))).map((currency) => <strong key={currency}>{fmt(metric.values.filter((v) => currencyCode(v.currency) === currency).reduce((sum, v) => sum + v.amount, 0), currency)}</strong>)}</div></article>)}
        <article><span className="metric-icon"><Users /></span><div><small>Toplam Firma</small><strong>{companies.length}</strong></div></article>
      </div>
      <section className="planning-top">
        <div className="section-heading">
          <span>ÖDEME YÖNETİMİ</span>
          <h2>Firma ve ödeme planları</h2>
          <p>
            Ödeme birimlerini yönetin, plan oluşturun ve gerçekleşen ödemeleri
            izleyin.
          </p>
        </div>
        <div className="planning-master">
          <div className="plan-select">
            <div className="filter-heading"><h3><Filter /> Filtrele</h3><button onClick={() => { setUnitStatus("TÜMÜ"); setPlannedGroup("PARTNER"); setPlannedType("TÜMÜ"); setFirm(partnerNames[0]); setUnitSearch(""); }}>Filtreleri Temizle</button></div>
            <Field l="ŞUBE (KAMPÜS) SORGU">
              <Select v={branch} set={() => {}} o={[branch]} />
            </Field>
            <Field l="DURUMU">
              <Select
                v={unitStatus}
                set={setUnitStatus}
                o={["TÜMÜ", "AKTİF", "PASİF"]}
              />
            </Field>
            <Field l="PLANLANAN GRUP">
              <Select
                v={plannedGroup}
                set={(group) => {
                  setPlannedGroup(group);
                  setPlannedType("TÜMÜ");
                  setFirm(planningGroupTypes[group]?.[0] ?? "");
                  setSelectedPlans([]);
                }}
                o={planningGroups}
              />
            </Field>
            <Field l="PLANLANAN TÜR">
              <Select
                v={plannedType}
                set={setPlannedType}
                o={["TÜMÜ", ...companies]}
              />
            </Field>
            <button
              className="add"
              onClick={() => {
                setEditingUnit(null);
                setUnitShow(true);
              }}
            >
              <Plus /> Ödeme Birimi Ekle
            </button>
            <button
              className="plan-archive-toggle"
              type="button"
              onClick={() => setShowPlanArchive((visible) => !visible)}
            >
              {showPlanArchive ? "Plan Yönetimini Gizle" : `Plan Yönetimini Aç (${plans.length})`}
            </button>
          </div>
          <div className="unit-list">
            <div className="unit-list-head">
              <label>
                Arama:{" "}
                <input
                  value={unitSearch}
                  onChange={(event) => setUnitSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="scroll">
              <table className="records unit-table">
                <thead>
                  <tr>
                    <th>SİL</th>
                    <th>GÜNCELLE</th>
                    <th>ÖDEME PLANLA</th>
                    <th>PLAN GRUP</th>
                    <th>ŞUBE ADI</th>
                    <th>FİRMA ADI</th>
                    <th>FİYAT</th>
                    <th>PLAN TARİHİ</th>
                    <th>SON ÖDEME TARİHİ</th>
                    <th>GİRİŞ TARİHİ</th>
                    <th>TELEFON</th>
                    <th>DURUMU</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUnits.length ? (
                    visibleUnits.map((unit) => {
                      const latestPlan = plans
                        .filter((plan) => plan.company === unit.name && plan.type === unit.group)
                        .sort((a, b) => (b.entryDate ?? b.invoiceDate).localeCompare(a.entryDate ?? a.invoiceDate))[0];
                      return <tr key={unit.id}>
                        <td>
                          <button
                            className="mini red"
                            onClick={() =>
                              setUnits(
                                units.filter((item) => item.id !== unit.id),
                              )
                            }
                          >
                            Sil
                          </button>
                        </td>
                        <td>
                          <button
                            className="mini blue"
                            onClick={() => {
                              setEditingUnit(unit);
                              setUnitShow(true);
                            }}
                          >
                            Güncelle
                          </button>
                        </td>
                        <td>
                          <button
                            className="mini plan-unit"
                            onClick={() => {
                              setFirm(unit.name);
                              setPlanCompany(unit.name);
                              setEditingPlan(null);
                              setPlanShow(true);
                            }}
                          >
                            Ödeme Planla
                          </button>
                        </td>
                        <td>{unit.group}</td>
                        <td>{unit.branch}</td>
                        <td>{unit.name}</td>
                        <td>{latestPlan ? fmt(latestPlan.amount, latestPlan.currency) : "—"}</td>
                        <td>{latestPlan ? formatDate(latestPlan.invoiceDate) : "—"}</td>
                        <td>{latestPlan ? formatDate(latestPlan.due) : "—"}</td>
                        <td>{latestPlan ? formatDate(latestPlan.entryDate ?? latestPlan.invoiceDate) : "—"}</td>
                        <td>{unit.phone || "-"}</td>
                        <td>
                          <span className="active-status">{unit.status}</span>
                        </td>
                      </tr>;
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="none">
                        Bu gruba ait kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <small className="unit-count">
              {visibleUnits.length} kayıt gösteriliyor.
            </small>
          </div>
        </div>
      </section>
      <section className="plan-list" hidden={!showPlanArchive}>
        <div className="plan-actions">
          <button
            className="delete"
            disabled={!selectedPlans.length}
            onClick={() => {
              const unpaidPlans = plans.filter(
                (plan) => selectedPlans.includes(plan.id) && plan.paid <= 0,
              );
              if (unpaidPlans.length) {
                setDeleteError(
                  `Ödeme yapılmamış ${unpaidPlans.length} plan silinemez. Önce ödeme kaydı oluşturun.`,
                );
                return;
              }
              setDeleteError("");
              setPlans(
                plans.filter((plan) => !selectedPlans.includes(plan.id)),
              );
              setSelectedPlans([]);
            }}
          >
            <Trash2 /> Seçilenleri Sil
          </button>
          <button
            className="add"
            onClick={() => {
              setEditingPlan(null);
              setPlanCompany(firm);
              setPlanShow(true);
            }}
          >
            <Plus /> ÖDEME PLANLA
          </button>
          <Field l="PLANLAMA YAPILAN FİRMA">
            <Select v={firm} set={setFirm} o={companies} />
          </Field>
          <Field l="YIL">
            <Select
              v={yearFilter}
              set={setYearFilter}
              o={["--Seçiniz--", "2026"]}
            />
          </Field>
          <Field l="AY">
            <Select
              v={monthFilter}
              set={setMonthFilter}
              o={["--Seçiniz--", "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"]}
            />
          </Field>
          <Field l="PARA BİRİMİ">
            <Select
              v={currencyFilter}
              set={(currency) => {
                setCurrencyFilter(currency);
                setSelectedPlans([]);
              }}
              o={["--Seçiniz--", "TRY", "USD", "EUR"]}
            />
          </Field>
          <Field l="SİPARİŞ DURUMU">
            <Select
              v={orderFilter}
              set={setOrderFilter}
              o={["--Seçiniz--", "VERİLDİ", "VERİLMEDİ", "BEKLİYOR"]}
            />
          </Field>
        </div>
        {deleteError ? <div className="form-error" role="alert">{deleteError}</div> : null}
        <div className="scroll">
          <table className="records plan-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Tümünü seç"
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((plan) => selectedPlans.includes(plan.id))
                    }
                    onChange={(event) =>
                      setSelectedPlans(
                        event.target.checked
                          ? Array.from(
                              new Set([
                                ...selectedPlans,
                                ...filtered.map((plan) => plan.id),
                              ]),
                            )
                          : selectedPlans.filter(
                              (id) => !filtered.some((plan) => plan.id === id),
                            ),
                      )
                    }
                  />
                </th>
                <th>BÖLÜM</th>
                <th>FİRMA</th>
                <th>TÜRÜ</th>
                <th>GRUP</th>
                <th>KASA / HESAP</th>
                <th>FATURA TARİHİ</th>
                <th>GİRİŞ TARİHİ</th>
                <th>FATURA ÖD. TARİHİ</th>
                <th>YILLAR</th>
                <th>FATURA AY</th>
                <th>AYLIK TUTAR</th>
                <th>ÖDENEN TUTAR</th>
                <th>KALAN TUTAR</th>
                <th>ÖDEME</th>
                <th>SİPARİŞ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      aria-label={`${p.company} planını seç`}
                      type="checkbox"
                      checked={selectedPlans.includes(p.id)}
                      onChange={(event) =>
                        setSelectedPlans(
                          event.target.checked
                            ? [...selectedPlans, p.id]
                            : selectedPlans.filter((id) => id !== p.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="mini blue"
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanShow(true);
                      }}
                    >
                      Değiştir
                    </button>{" "}
                    <button
                      className="mini orange"
                      disabled={p.amount <= 0 || p.amount - p.paid <= 0}
                      title={
                        p.amount > 0 && p.amount - p.paid <= 0
                          ? "Bu planın ödemesi tamamlandı"
                          : p.amount <= 0
                            ? "Ödeme yapabilmek için plan tutarını güncelleyin"
                            : `${fmt(p.amount - p.paid, p.currency)} ödeme bekliyor`
                      }
                      onClick={() => {
                        if (p.amount > 0 && p.amount - p.paid > 0) openPay(p);
                      }}
                    >
                      {p.amount > 0 && p.amount - p.paid <= 0
                        ? "Ödendi"
                        : p.amount <= 0
                          ? "Tutar Gir"
                          : "Ödeme"}
                    </button>
                  </td>
                  <td>{p.company}</td>
                  <td>{p.type}</td>
                  <td>{p.group}</td>
                  <td>{p.account || "—"}</td>
                  <td>{formatDate(p.invoiceDate)}</td>
                  <td>{formatDate(p.entryDate ?? p.invoiceDate)}</td>
                  <td>{formatDate(p.due)}</td>
                  <td>{p.year}</td>
                  <td>{p.month}</td>
                  <td>{p.amount.toFixed(2)}</td>
                  <td>{p.paid.toFixed(2)}</td>
                  <td>{Math.max(0, p.amount - p.paid).toFixed(2)}</td>
                  <td className="status">{planStatus(p.amount, p.paid)}</td>
                  <td
                    className={`status order-status ${
                      p.order === "VERİLDİ"
                        ? "order-given"
                        : p.order === "VERİLMEDİ"
                          ? "order-not-given"
                          : "order-pending"
                    }`}
                  >
                    {p.order}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length ? (
              <tfoot>
                <tr className="table-total">
                  <td colSpan={11}>TOPLAM</td>
                  <td>{totalsByCurrency(filtered, (plan) => plan.amount, (plan) => plan.currency)}</td>
                  <td>{totalsByCurrency(filtered, (plan) => plan.paid, (plan) => plan.currency)}</td>
                  <td>{totalsByCurrency(filtered, (plan) => Math.max(0, plan.amount - plan.paid), (plan) => plan.currency)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
      {planShow && (
        <PlanModal
          companies={companies}
          initial={editingPlan ?? undefined}
          defaultCompany={planCompany ?? firm}
          defaultPaymentGroup={plannedGroup}
          close={() => {
            setPlanShow(false);
            setEditingPlan(null);
            setPlanCompany(null);
          }}
          save={savePlan}
        />
      )}
      {unitShow && (
        <PaymentUnitModal
          defaultGroup={plannedGroup}
          defaultScope="Kampüs"
          initial={editingUnit ?? undefined}
          initialPlan={editingUnit
            ? plans
                .filter((plan) => plan.company === editingUnit.name && plan.type === editingUnit.group)
                .sort((a, b) => (b.entryDate ?? b.invoiceDate).localeCompare(a.entryDate ?? a.invoiceDate))[0]
            : undefined}
          close={() => {
            setUnitShow(false);
            setEditingUnit(null);
          }}
          save={(unit, plan, planId) => {
            if (editingUnit) {
              setUnits(
                units.map((item) =>
                  item.id === editingUnit.id
                    ? { ...unit, id: editingUnit.id }
                    : item,
                ),
              );
            } else {
              setUnits([{ ...unit, id: createNumericId() }, ...units]);
            }
            if (plan) {
              if (planId) {
                setPlans(plans.map((item) => item.id === planId
                  ? {
                      ...item,
                      ...plan,
                      paid: Math.min(item.paid, plan.amount),
                      payment: planStatus(plan.amount, Math.min(item.paid, plan.amount)),
                    }
                  : item));
              } else {
                setPlans([
                  { id: createNumericId(), paid: 0, payment: "ÖDENMEDİ", ...plan },
                  ...plans,
                ]);
              }
            }
            setFirm(unit.name);
            setPlannedGroup(unit.group);
            setUnitShow(false);
            setEditingUnit(null);
          }}
        />
      )}
    </>
  );
}

function PaymentUnitModal({
  close,
  save,
  defaultGroup,
  defaultScope,
  initial,
  initialPlan,
}: {
  close: () => void;
  save: (unit: Omit<PaymentUnit, "id">, plan?: PlanInput, planId?: number) => void;
  defaultGroup: string;
  defaultScope: PaymentUnit["scope"];
  initial?: PaymentUnit;
  initialPlan?: Plan;
}) {
  const [form, setForm] = useState<Omit<PaymentUnit, "id">>({
    group: initial?.group ?? defaultGroup,
    scope: "Proje",
    name: initial?.name ?? "--Seçiniz--",
    branch: initial?.branch ?? branch,
    country: initial?.country ?? "--Seçiniz--",
    region: initial?.region ?? "--Seçiniz--",
    phone: initial?.phone ?? "",
    status: initial?.status ?? "AKTİF",
  });
  const [planForm, setPlanForm] = useState({
    amount: initialPlan ? String(initialPlan.amount) : "",
    currency: initialPlan?.currency ?? "TRY",
    invoiceDate: initialPlan?.invoiceDate ?? today,
    entryDate: initialPlan?.entryDate ?? initialPlan?.invoiceDate ?? today,
    due: initialPlan?.due ?? today,
    order: initialPlan?.order ?? "BEKLİYOR",
    description: initialPlan?.description ?? "",
    account: initialPlan?.account ?? accounts.find((item) => item.currency === (initialPlan?.currency ?? "TRY"))?.name ?? "",
  });
  const [error, setError] = useState("");
  const hasCountrySelection = outgoingCountries.includes(form.country);
  const countryPartners = hasCountrySelection
    ? partnerCatalog.filter((partner) => partner.country === form.country)
    : partnerCatalog;
  const countryRegions = Array.from(
    new Set(countryPartners.map((partner) => partner.region)),
  );
  const submit = () => {
    if (!(planningGroupTypes[form.group] ?? []).includes(form.name)) {
      setError("Planlanan türü seçiniz.");
      return;
    }
    const amount = Number(planForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Planlanan ödeme tutarını giriniz.");
      return;
    }
    if (!planForm.account) {
      setError("Ödeme yapılacak kasa veya hesabı seçiniz.");
      return;
    }
    if (!planForm.invoiceDate || !planForm.entryDate || !planForm.due) {
      setError("Plan, giriş ve son ödeme tarihlerini seçiniz.");
      return;
    }
    if (planForm.due < planForm.invoiceDate || planForm.due < planForm.entryDate) {
      setError("Son ödeme tarihi, plan ve giriş tarihinden önce olamaz.");
      return;
    }
    const date = new Date(`${planForm.due}T00:00:00`);
    const months = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
    save(
      { ...form, scope: "Proje" },
      {
        company: form.name,
        type: form.group,
        group: form.group === "PARTNER" ? form.region : form.name,
        invoiceDate: planForm.invoiceDate,
        entryDate: planForm.entryDate,
        due: planForm.due,
        year: String(date.getFullYear()),
        month: months[date.getMonth()],
        amount,
        currency: planForm.currency,
        order: planForm.order,
        installments: 1,
        description: planForm.description,
        donationGap: 0,
        account: planForm.account,
      },
      initialPlan?.id,
    );
  };
  return (
    <Modal title={initial ? "ÖDEME PLANI VE BİRİM GÜNCELLEME FORMU" : "ÖDEME PLANLAMA VE KAYIT FORMU"} close={close}>
      <div className="company-modal-grid">
        <Field l="ŞUBE (KAMPÜS)">
          <Select v={branch} set={() => {}} o={[branch]} />
        </Field>
        <Field l="PLANLANAN GRUP">
          <Select
            v={form.group}
            set={(group) => setForm({
              ...form,
              group,
              name: planningGroupTypes[group]?.[0] ?? "",
              country: group === "PARTNER" ? "--Seçiniz--" : "",
              region: group === "PARTNER" ? "--Seçiniz--" : "",
            })}
            o={planningGroups}
          />
        </Field>
        <Field l="BİRİM TÜRÜ">
          <Select
            v={form.scope}
            set={(scope) =>
              setForm({ ...form, scope: scope as PaymentUnit["scope"] })
            }
            o={["Proje"]}
          />
        </Field>
        {form.group === "PARTNER" ? <Field l="GİDEN ÜLKE (İSTEĞE BAĞLI)">
          <Select
            v={form.country}
            set={(country) => {
              const matches = partnerCatalog.filter((partner) => partner.country === country);
              setForm({
                ...form,
                country,
                name: matches[0]?.name ?? "",
                region: matches[0]?.region ?? "--Seçiniz--",
                status: matches[0]?.status ?? "AKTİF",
              });
            }}
            o={["--Seçiniz--", ...outgoingCountries]}
          />
        </Field> : null}
        {form.group === "PARTNER" ? <Field l="GİDEN BÖLGE (İSTEĞE BAĞLI)">
          <Select
            v={form.region}
            set={(region) => setForm({ ...form, region })}
            o={["--Seçiniz--", ...countryRegions]}
          />
        </Field> : null}
        <Field l={form.group === "PARTNER" ? "FİRMA - (PARTNER) ADI" : "PLANLANAN TÜR"}>
          <Select
            v={form.name}
            set={(name) => {
              const partner = countryPartners.find((item) => item.name === name);
              setForm({
                ...form,
                name,
                country: partner?.country ?? form.country,
                region: partner?.region ?? form.region,
                status: partner?.status ?? form.status,
              });
            }}
            o={form.group === "PARTNER"
              ? ["--Seçiniz--", ...countryPartners.map((partner) => partner.name)]
              : planningGroupTypes[form.group] ?? []}
          />
        </Field>
        {form.group === "PARTNER" ? <Field l="FİRMA TELEFON (İSTEĞE BAĞLI)">
          <input
            type="tel"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
            placeholder="+90 5__ ___ __ __"
          />
        </Field> : null}
        <>
          <Field l="PLANLANAN TUTAR">
            <input
              type="number"
              min={0}
              step="0.01"
              value={planForm.amount}
              onChange={(event) => setPlanForm({ ...planForm, amount: event.target.value })}
              placeholder="Tutar giriniz"
            />
          </Field>
          <Field l="PARA BİRİMİ">
            <Select
              v={planForm.currency}
              set={(currency) => setPlanForm({
                ...planForm,
                currency,
                account: accounts.find((item) => item.currency === currency)?.name ?? "",
              })}
              o={["TRY", "USD", "EUR"]}
            />
          </Field>
          <Field l="ÖDEME YAPILACAK KASA / HESAP">
            <Select
              v={planForm.account}
              set={(account) => setPlanForm({ ...planForm, account })}
              o={accounts.filter((item) => item.currency === planForm.currency).map((item) => item.name)}
            />
          </Field>
          <Field l="PLAN / FATURA TARİHİ">
            <TurkishDateInput
              value={planForm.invoiceDate}
              setValue={(invoiceDate) => setPlanForm({ ...planForm, invoiceDate })}
            />
          </Field>
          <Field l="GİRİŞ TARİHİ">
            <TurkishDateInput
              value={planForm.entryDate}
              setValue={(entryDate) => setPlanForm({ ...planForm, entryDate })}
            />
          </Field>
          <Field l="SON ÖDEME TARİHİ">
            <TurkishDateInput
              value={planForm.due}
              setValue={(due) => setPlanForm({ ...planForm, due })}
            />
          </Field>
          <Field l="SİPARİŞ / PLAN DURUMU">
            <Select
              v={planForm.order}
              set={(order) => setPlanForm({ ...planForm, order })}
              o={["BEKLİYOR", "VERİLMEDİ", "VERİLDİ"]}
            />
          </Field>
          <Field l="AÇIKLAMA">
            <input
              value={planForm.description}
              onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })}
              placeholder="Ödeme planı açıklaması"
            />
          </Field>
        </>
      </div>
      {form.group === "PARTNER" ? <fieldset className="company-status">
        <legend>AKTİF DURUMU</legend>
        <label>
          <input
            type="radio"
            name="company-status"
            checked={form.status === "AKTİF"}
            onChange={() => setForm({ ...form, status: "AKTİF" })}
          />{" "}
          AKTİF
        </label>
        <label>
          <input
            type="radio"
            name="company-status"
            checked={form.status === "PASİF"}
            onChange={() => setForm({ ...form, status: "PASİF" })}
          />{" "}
          PASİF
        </label>
      </fieldset> : null}
      {error ? <div className="company-error">{error}</div> : null}
      <button className="add company-save" onClick={submit}>
        {initial ? "Planı ve Birimi Güncelle" : "Planı Kaydet"}
      </button>
    </Modal>
  );
}

function PlanModal({
  close,
  save,
  companies,
  initial,
  defaultCompany,
  defaultPaymentGroup,
}: {
  close: () => void;
  save: (p: PlanInput) => void;
  companies: string[];
  initial?: Plan;
  defaultCompany: string;
  defaultPaymentGroup: string;
}) {
  const initialPlanningGroup =
    initial?.type && planningGroups.includes(initial.type)
      ? initial.type
      : partnerNames.includes(initial?.company ?? "")
        ? "PARTNER"
        : defaultPaymentGroup;
  const availableTypes = planningGroupTypes[initialPlanningGroup] ?? companies;
  const [f, setF] = useState({
    company: availableTypes.includes(initial?.company ?? "")
      ? initial!.company
      : availableTypes.includes(defaultCompany)
        ? defaultCompany
        : availableTypes[0] ?? "",
    type: initialPlanningGroup,
    group: initial?.group ?? "GENEL",
    invoiceDate: initial?.invoiceDate ?? today,
    entryDate: initial?.entryDate ?? initial?.invoiceDate ?? today,
    due: initial?.due ?? today,
    year: initial?.year ?? "2026",
    month: initial?.month ?? "EYLÜL",
    amount: initial ? String(initial.amount) : "",
    currency: initial?.currency ?? "USD",
    order: initial?.order ?? "BEKLİYOR",
    installments: initial?.installments ?? 1,
    description: initial?.description ?? "",
    donationGap: initial?.donationGap ? String(initial.donationGap) : "",
    account: initial?.account ?? accounts.find((item) => item.currency === (initial?.currency ?? "USD"))?.name ?? "",
  });
  const [error, setError] = useState("");
  const submitPlan = () => {
    const amount = Number(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Plan tutarı 0 olamaz. Ödenecek gerçek tutarı giriniz.");
      return;
    }
    if (!f.account) {
      setError("Ödeme yapılacak kasa veya hesabı seçiniz.");
      return;
    }
    if (!f.invoiceDate || !f.entryDate || !f.due) {
      setError("Plan, giriş ve son ödeme tarihlerini seçiniz.");
      return;
    }
    if (f.due < f.invoiceDate || f.due < f.entryDate) {
      setError("Son ödeme tarihi, plan ve giriş tarihinden önce olamaz.");
      return;
    }
    setError("");
    save({ ...f, amount, donationGap: Number(f.donationGap) || 0 });
  };
  return (
    <Modal title="ÖDEME PLANLAMA EKRANI" close={close}>
      <div className="modal-grid">
        <Field l="PLANLANAN GRUP">
          <Select
            v={f.type}
            set={(group) =>
              setF({
                ...f,
                type: group,
                company: planningGroupTypes[group]?.[0] ?? "",
                group: group === "PARTNER" ? "GENEL" : planningGroupTypes[group]?.[0] ?? "GENEL",
              })
            }
            o={planningGroups}
          />
        </Field>
        <Field l="TÜR">
          <Select
            v={f.company}
            set={(v) => setF({ ...f, company: v, group: f.type === "PARTNER" ? f.group : v })}
            o={planningGroupTypes[f.type] ?? []}
          />
        </Field>
        <Field l="FATURA TARİHİ">
          <TurkishDateInput value={f.invoiceDate} setValue={(value) => setF({ ...f, invoiceDate: value })} />
        </Field>
        <Field l="GİRİŞ TARİHİ">
          <TurkishDateInput value={f.entryDate} setValue={(value) => setF({ ...f, entryDate: value })} />
        </Field>
        <Field l="FAT. ÖDEME TAR.">
          <TurkishDateInput value={f.due} setValue={(value) => setF({ ...f, due: value })} />
        </Field>
        <Field l="ALT TÜR / PROJE">
          <Select
            v={f.group}
            set={(v) => setF({ ...f, group: v })}
            o={f.type === "PARTNER"
              ? ["GENEL", "NAFİLE KURBAN", "CAMİ İNŞAATI", "SU KUYUSU", "YETİM GİYİM"]
              : [f.company]}
          />
        </Field>
        <Field l="BAĞIŞ AÇIĞI">
          <input
            type="number"
            min={0}
            step="0.01"
            value={f.donationGap}
            onChange={(e) => setF({ ...f, donationGap: e.target.value })}
          />
        </Field>
        <Field l="ÖDEME AYI & BAŞLANGIÇ AYI">
          <Select
            v={f.month}
            set={(month) => setF({ ...f, month })}
            o={[
              "OCAK",
              "ŞUBAT",
              "MART",
              "NİSAN",
              "MAYIS",
              "HAZİRAN",
              "TEMMUZ",
              "AĞUSTOS",
              "EYLÜL",
              "EKİM",
              "KASIM",
              "ARALIK",
            ]}
          />
        </Field>
        <Field l="TAKSİT SAYISI">
          <input
            type="number"
            min={1}
            value={f.installments}
            onChange={(e) =>
              setF({ ...f, installments: Math.max(1, Number(e.target.value)) })
            }
          />
        </Field>
        <Field l="FAT/ÖD. YIL">
          <Select
            v={f.year}
            set={(v) => setF({ ...f, year: v })}
            o={["2026", "2027"]}
          />
        </Field>
        <Field l="TUTAR">
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={f.amount}
            onChange={(e) => {
              setF({ ...f, amount: e.target.value });
              setError("");
            }}
          />
        </Field>
        <Field l="PARA BİRİMİ">
          <Select
            v={f.currency}
            set={(v) => setF({
              ...f,
              currency: v,
              account: accounts.find((item) => item.currency === v)?.name ?? "",
            })}
            o={["TRY", "USD", "EUR"]}
          />
        </Field>
        <Field l="ÖDEME YAPILACAK KASA / HESAP">
          <Select
            v={f.account}
            set={(account) => setF({ ...f, account })}
            o={accounts.filter((item) => item.currency === f.currency).map((item) => item.name)}
          />
        </Field>
        <Field l="SİPARİŞ DURUMU">
          <Select
            v={f.order}
            set={(order) => setF({ ...f, order })}
            o={["BEKLİYOR", "VERİLDİ", "VERİLMEDİ"]}
          />
        </Field>
        <Field l="AÇIKLAMA">
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Field>
      </div>
      <div className="plan-balance">
        <span>BAKİYE</span>
        <strong>{fmt(Number(f.donationGap) || 0, f.currency)}</strong>
      </div>
      {error ? <div className="payment-error">{error}</div> : null}
      <button className="add center" onClick={submitPlan}>
        {initial ? "Planı Güncelle" : "Aktif Plan Kaydet"}
      </button>
    </Modal>
  );
}
function Payment({
  plan,
  transactions,
  rows,
  close,
  pay,
}: {
  plan: Plan;
  transactions: Row[];
  rows: Row[];
  close: () => void;
  pay: (n: number, a: string, note: string) => void;
}) {
  const remaining = Math.max(0, plan.amount - plan.paid);
  const [amount, setAmount] = useState(remaining),
    [account, setAccount] = useState(plan.account ?? "--Seçiniz--"),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [showBalanceWarning, setShowBalanceWarning] = useState(false);
  const accountOptions = accounts
    .filter((item) => item.currency === plan.currency)
    .map((item) => item.name);
  const currentBalance = account === "--Seçiniz--"
    ? 0
    : getAccountBalance(rows, account, currencyCode(plan.currency));
  const projectedBalance = currentBalance - amount;
  const submitPayment = () => {
    if (account === "--Seçiniz--") {
      setError("Ödeme gönderilecek kasa veya banka hesabını seçiniz.");
      return;
    }
    if (amount <= 0 || amount > remaining) {
      setError(
        `Ödeme tutarı 0'dan büyük ve en fazla ${fmt(remaining, plan.currency)} olabilir.`,
      );
      return;
    }
    if (projectedBalance < 0) {
      setShowBalanceWarning(true);
      return;
    }
    setError("");
    pay(amount, account, note);
  };
  return (
    <Modal title="ÖDEME FORMU" close={close}>
      <div className="payment-layout">
        <div className="debt">
          <table>
            <thead>
              <tr>
                <th>ÖDEME TÜRÜ</th>
                <th>GELİR</th>
                <th>GİDER</th>
                <th>KALAN</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length ? (
                transactions.map((transaction, index) => {
                  const paidThroughRow = transactions
                    .slice(0, index + 1)
                    .reduce((sum, row) => sum + row.amount, 0);
                  return (
                    <tr key={transaction.id}>
                      <td>{transaction.payment}</td>
                      <td>0,00</td>
                      <td>{fmt(transaction.amount, transaction.currency)}</td>
                      <td>
                        {fmt(
                          Math.max(0, plan.amount - paidThroughRow),
                          plan.currency,
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>Henüz ödeme kaydı yok</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="table-total">
                <td>TOPLAM</td>
                <td>—</td>
                <td>{fmt(transactions.reduce((sum, transaction) => sum + transaction.amount, 0), plan.currency)}</td>
                <td>{fmt(Math.max(0, plan.amount - plan.paid), plan.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="modal-grid">
          <Field l="ŞUBE">
            <input value={branch} readOnly />
          </Field>
          <Field l="İŞLEM YAPAN">
            <input value="ARAFAT ŞİMŞEK" readOnly />
          </Field>
          <Field l="YIL">
            <input value={plan.year} readOnly />
          </Field>
          <Field l="AY">
            <input value={plan.month} readOnly />
          </Field>
          <Field l="FİRMA/PARTNER">
            <input value={plan.company} readOnly />
          </Field>
          <Field l="BARKOD">
            <input
              value={`${plan.id}-${plan.company}-${plan.group}-${formatDate(plan.due)}`}
              readOnly
            />
          </Field>
          <Field l="KAYIT TARİHİ">
            <input value={formatDate(today)} readOnly />
          </Field>
          <Field l="ÜLKE">
            <input value="TÜRKİYE" readOnly />
          </Field>
          <Field l="İL/BÖLGE">
            <input value="GENEL MERKEZ" readOnly />
          </Field>
          <Field l="ÖDENEN TARİHİ">
            <input value={formatDate(today)} readOnly />
          </Field>
          <Field l="ÖDENEN GRUP">
            <input value="PARTNER ÖDEMESİ" readOnly />
          </Field>
          <Field l="BAĞIŞ TÜRÜ">
            <input value={plan.type} readOnly />
          </Field>
          <Field l="PROJE(GRUP)">
            <input value={plan.group} readOnly />
          </Field>
          <Field l="ÖDEME GÖN. KASA">
            <Select
              v={account}
              set={(value) => { setAccount(value); setShowBalanceWarning(false); }}
              o={["--Seçiniz--", ...accountOptions]}
            />
          </Field>
          <Field l="ÖDENEN KALEM">
            <Select v={plan.group} set={() => {}} o={[plan.group]} />
          </Field>
          <Field l="PARA BİRİMİ">
            <input value={plan.currency} readOnly />
          </Field>
          <Field l="TUTAR">
            <input
              type="number"
              min={0.01}
              max={remaining}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value));
                setError("");
                setShowBalanceWarning(false);
              }}
            />
          </Field>
          <Field l="AÇIKLAMA">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      <p className="payment-note">
        Not: Kısmi ödeme yapabilirsiniz. Girilen tutar kalan borcu aşamaz.
      </p>
      {account !== "--Seçiniz--" ? <div className="payment-balance-preview">
        <span>Mevcut bakiye: <b>{fmt(currentBalance, plan.currency)}</b></span>
        <span>İşlem sonrası: <b className={projectedBalance < 0 ? "negative" : ""}>{fmt(projectedBalance, plan.currency)}</b></span>
      </div> : null}
      {showBalanceWarning ? <div className="inline-balance-warning" role="alert">
        <div>
          <strong>Kasa bakiyesi eksiye düşecek</strong>
          <span>Bu ödeme sonrasında {account} bakiyesi {fmt(projectedBalance, plan.currency)} olacak. İşleme devam edilsin mi?</span>
        </div>
        <div>
          <button type="button" onClick={() => setShowBalanceWarning(false)}>Hayır</button>
          <button type="button" className="confirm" onClick={() => { setShowBalanceWarning(false); setError(""); pay(amount, account, note); }}>Evet, devam et</button>
        </div>
      </div> : null}
      {error ? <div className="payment-error">{error}</div> : null}
      <button
        className="exit payment-save"
        disabled={
          remaining <= 0 ||
          account === "--Seçiniz--" ||
          amount <= 0 ||
          amount > remaining
        }
        onClick={submitPayment}
      >
        <CheckCircle2 /> ÖDEMEYİ KAYDET VE KASADAN DÜŞ
      </button>
      <div className="balances">
        <span>
          BORÇ: <b>{plan.amount.toFixed(2)}</b>
        </span>
        <span>
          ÖDENEN: <b>{plan.paid.toFixed(2)}</b>
        </span>
        <span>
          KALAN: <b>{(plan.amount - plan.paid).toFixed(2)}</b>
        </span>
      </div>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-title">
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
        <button className="modal-close" onClick={close}>
          Kapat
        </button>
      </div>
    </div>
  );
}
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <b>{l}:</b>
      {children}
    </label>
  );
}
function Select({
  v,
  set,
  o,
}: {
  v: string;
  set: (v: string) => void;
  o: string[];
}) {
  return (
    <div className="select">
      <select value={v} onChange={(e) => set(e.target.value)}>
        {o.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <ChevronDown />
    </div>
  );
}
