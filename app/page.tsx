"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Chargement...
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen p-4 space-y-6">

      {/* ================= HEADER ================= */}
      <div>
        <h1 className="text-xl font-bold">Dashboard Imad</h1>
        <p className="text-sm opacity-60">{data.currentMonth}</p>
      </div>

      {/* ================= KPI ================= */}
      <section className="grid grid-cols-2 gap-3">

        <Card className="p-4">
          <p className="text-xs opacity-60">CA total</p>
          <p className="text-lg font-bold">
            {Math.round(data.totalRevenus)} €
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs opacity-60">Dépenses</p>
          <p className="text-lg font-bold">
            {Math.round(data.totalDepenses)} €
          </p>
        </Card>

        <Card className="p-4 col-span-2">
          <p className="text-xs opacity-60">Bénéfice</p>
          <p className="text-2xl font-bold text-green-400">
            {Math.round(data.totalRevenus - data.totalDepenses)} €
          </p>
        </Card>

        <Card className="p-4 col-span-2">
          <p className="text-xs opacity-60">Progression mois vs mois</p>
          <p className="text-xl font-bold">
            {data.progressionMois?.toFixed(1)} %
          </p>
        </Card>

      </section>

      {/* ================= FACTURES URGENTES ================= */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Factures à payer</h2>

        {data.aPayerList?.slice(0, 4).map((f: any, i: number) => (
          <Card key={i} className="p-4 flex justify-between items-center">

            <div>
              <p className="font-semibold">{f.fournisseur}</p>
              <p className="text-sm opacity-60">{f.montantHT} €</p>
              <p className="text-xs opacity-40">{f.echeance}</p>
            </div>

            <div className={f.retard ? "text-red-500" : "text-orange-400"}>
              {f.retard ? "En retard" : "À payer"}
            </div>

          </Card>
        ))}
      </section>

      {/* ================= EVOLUTION CA ================= */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">CA journalier</h2>

        <Card className="p-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.evolutionJournaliere}>
              <Line
                type="monotone"
                dataKey="ca"
                stroke="#22c55e"
                strokeWidth={2}
              />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Catégories</h2>

        <Card className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={Object.entries(data.venteParCat).map(([k, v]) => ({
                  name: k,
                  value: v,
                }))}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
              >
                {Object.keys(data.venteParCat).map((_, i) => (
                  <Cell
                    key={i}
                    fill={["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"][i % 4]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ================= SEUIL RENTABILITÉ ================= */}
      <section>
        <Card className="p-4">
          <p className="text-xs opacity-60">Seuil rentabilité</p>
          <p className="text-xl font-bold">
            {Math.round(data.seuilRentabilite || 0)} €
          </p>
        </Card>
      </section>

    </div>
  );
}
