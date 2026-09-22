const currencyAliases: Record<string, string> = {
  DOLAR: "USD",
  EURO: "EUR",
};

const allowedPairs = new Set([
  "TRY-USD",
  "TRY-EUR",
  "USD-TRY",
  "USD-EUR",
  "EUR-TRY",
  "EUR-USD",
]);

const tcmbValue = (xml: string, currency: "USD" | "EUR") => {
  const block = xml.match(new RegExp(`<Currency[^>]+CurrencyCode="${currency}"[\\s\\S]*?<\\/Currency>`))?.[0];
  const value = block?.match(/<ForexSelling>([^<]+)<\/ForexSelling>/)?.[1];
  return value ? Number(value.replace(",", ".")) : NaN;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = currencyAliases[url.searchParams.get("from") ?? ""] ?? url.searchParams.get("from") ?? "";
  const to = currencyAliases[url.searchParams.get("to") ?? ""] ?? url.searchParams.get("to") ?? "";

  if (!allowedPairs.has(`${from}-${to}`)) {
    return Response.json({ error: "Desteklenmeyen döviz dönüşümü." }, { status: 400 });
  }

  try {
    const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      cache: "no-store",
      headers: { "User-Agent": "MKS-On-Muhasebe/1.0" },
    });
    if (!response.ok) throw new Error("TCMB kuru alınamadı.");

    const xml = await response.text();
    const tryValues = {
      TRY: 1,
      USD: tcmbValue(xml, "USD"),
      EUR: tcmbValue(xml, "EUR"),
    };
    const fromTry = tryValues[from as keyof typeof tryValues];
    const toTry = tryValues[to as keyof typeof tryValues];
    if (!Number.isFinite(fromTry) || !Number.isFinite(toTry) || toTry <= 0) {
      throw new Error("TCMB kur verisi okunamadı.");
    }

    return Response.json({
      from,
      to,
      rate: Number((fromTry / toTry).toFixed(6)),
      source: "TCMB",
      date: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }),
    });
  } catch {
    return Response.json({ error: "Güncel kura şu anda ulaşılamıyor. Kuru elle girebilirsiniz." }, { status: 503 });
  }
}
