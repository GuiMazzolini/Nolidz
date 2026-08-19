"use client";

import { useT } from "@/app/i18n/client";

const ADULTS = [
  { eu: 36, uk: "3.5", usMen: "4", usWomen: "5.5", cm: "22.5", jp: "225" },
  { eu: 37, uk: "4",   usMen: "4.5", usWomen: "6",  cm: "23",   jp: "230" },
  { eu: 38, uk: "5",   usMen: "5.5", usWomen: "7",  cm: "24",   jp: "240" },
  { eu: 39, uk: "5.5", usMen: "6",   usWomen: "7.5",cm: "24.5", jp: "245" },
  { eu: 40, uk: "6.5", usMen: "7",   usWomen: "8.5",cm: "25.5", jp: "255" },
  { eu: 41, uk: "7",   usMen: "7.5", usWomen: "9",  cm: "26",   jp: "260" },
  { eu: 42, uk: "8",   usMen: "8.5", usWomen: "10", cm: "26.5", jp: "265" },
  { eu: 43, uk: "9",   usMen: "9.5", usWomen: "11", cm: "27.5", jp: "275" },
  { eu: 44, uk: "9.5", usMen: "10",  usWomen: "11.5",cm: "28",  jp: "280" },
  { eu: 45, uk: "10.5",usMen: "11",  usWomen: "12.5",cm: "29",  jp: "290" },
  { eu: 46, uk: "11",  usMen: "11.5",usWomen: "13", cm: "29.5", jp: "295" },
  { eu: 47, uk: "12",  usMen: "12.5",usWomen: "14", cm: "30",   jp: "300" },
];

const KIDS = [
  { eu: 28, uk: "10",  usMen: "10.5",usWomen: "11", cm: "17",   jp: "170" },
  { eu: 29, uk: "11",  usMen: "11.5",usWomen: "12", cm: "18",   jp: "180" },
  { eu: 30, uk: "11.5",usMen: "12",  usWomen: "12.5",cm: "18.5",jp: "185" },
  { eu: 31, uk: "12.5",usMen: "13",  usWomen: "13.5",cm: "19",  jp: "190" },
  { eu: 32, uk: "13",  usMen: "1",   usWomen: "2",  cm: "20",   jp: "200" },
  { eu: 33, uk: "1",   usMen: "1.5", usWomen: "2.5",cm: "20.5", jp: "205" },
  { eu: 34, uk: "2",   usMen: "2.5", usWomen: "3.5",cm: "21.5", jp: "215" },
  { eu: 35, uk: "2.5", usMen: "3",   usWomen: "4",  cm: "22",   jp: "220" },
];

const HEADERS = ["EU", "UK", "US Men", "US Women", "CM", "JP/KR"];

function SizeTable({ rows }: { rows: typeof ADULTS }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-ink/20">
          {HEADERS.map((h) => (
            <th key={h} className="py-2 px-3 text-left font-semibold text-ink/70 whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.eu} className="border-b border-ink/10 hover:bg-ink/5">
            <td className="py-2 px-3 font-medium">{r.eu}</td>
            <td className="py-2 px-3">{r.uk}</td>
            <td className="py-2 px-3">{r.usMen}</td>
            <td className="py-2 px-3">{r.usWomen}</td>
            <td className="py-2 px-3">{r.cm}</td>
            <td className="py-2 px-3">{r.jp}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SizeGuideModal({ onClose }: { onClose: () => void }) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink/10">
          <h2 className="font-display text-xl font-bold">{t.sizeGuide.title}</h2>
          <button
            onClick={onClose}
            className="text-ink/50 hover:text-ink transition-colors text-sm font-medium"
          >
            {t.sizeGuide.close} ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-6">
          <div>
            <h3 className="font-semibold text-sm text-ink/60 uppercase tracking-wide mb-3">
              {t.sizeGuide.adults}
            </h3>
            <div className="overflow-x-auto">
              <SizeTable rows={ADULTS} />
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-ink/60 uppercase tracking-wide mb-3">
              {t.sizeGuide.kids}
            </h3>
            <div className="overflow-x-auto">
              <SizeTable rows={KIDS} />
            </div>
          </div>

          <p className="text-xs text-ink/50 pb-2">{t.sizeGuide.note}</p>
        </div>
      </div>
    </div>
  );
}
