"use client";

import { useEffect, useState } from "react";

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
  const [display, setDisplay] = useState(() => formatDate(value));

  useEffect(() => setDisplay(formatDate(value)), [value]);

  const update = (nextDisplay: string) => {
    setDisplay(nextDisplay);
    if (!nextDisplay) {
      setValue("");
      return;
    }
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(nextDisplay);
    if (!match) return;
    const [, day, month, year] = match;
    const isoDate = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() + 1 === Number(month) &&
      parsed.getDate() === Number(day)
    ) {
      setValue(isoDate);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={10}
      placeholder="GG-AA-YYYY"
      aria-label="Tarih, gün-ay-yıl"
      value={display}
      onChange={(event) => update(event.target.value)}
      onBlur={() => setDisplay(formatDate(value))}
    />
  );
}
