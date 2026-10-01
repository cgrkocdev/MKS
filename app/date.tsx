"use client";

export const formatDate = (isoDate?: string) => {
  if (!isoDate) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-");
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() + 1 !== Number(month) ||
    parsed.getDate() !== Number(day)
  ) return "";
  return `${day}-${month}-${year}`;
};

export function TurkishDateInput({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <span className="turkish-date-picker">
      <input
        className="turkish-date-display"
        type="text"
        placeholder="GG-AA-YYYY"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        value={formatDate(value)}
      />
      <input
        className="turkish-date-native"
        type="date"
        aria-label="Takvimden tarih seç"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <span className="turkish-date-icon" aria-hidden="true">📅</span>
    </span>
  );
}
