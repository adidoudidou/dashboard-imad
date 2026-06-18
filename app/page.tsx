"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tab = "home" | "factures" | "ajouter";

export default function Page() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("home");

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

  const Card = ({ children }: any) => (
    <div className="bg-zinc-900 rounded-xl p-4">{children}</div>
  );

  // ================= HOME =================
  const Home = () => (
    <div className="space-y-4">

      <h1 className="text-xl font-bold">📊 Dashboard Imad</h1>

      {/* KPI principal */}
      <Card>
        <p className="text-xs opacity-60">Bénéfice</p>
        <p className="text-3xl font-bold text-green-400">
          {Math.round(data.totalRevenus - data.totalDepenses)} €
        </p>
      </Card>

      {/* KPI secondaires */}
      <div className="grid grid-cols-2 gap-3">

        <Card>
          <p className="text-xs opacity-60">CA</p>
          <p className="text-lg font-bold">
            {Math.round(data.totalRevenus)} €
          </p>
        </Card>

        <Card>
          <p className="text-xs opacity-60">Dépenses</p>
          <p className="text-lg font-bold">
            {Math.round(data.totalDepenses)} €
          </p>
        </Card>

      </div>

      {/* progression */}
      <Card>
        <p className="text-sm font-semibold">Progression mois</p>
        <p className="text-xl">
          {data.progressionMois?.toFixed(1)} %
        </p>
      </Card>

      {/* factures urgentes */}
      <h2 className="text-lg font-semibold">⚠️ À payer</h2>

      {data.aPayerList?.slice(0, 3).map((f: any, i: number) => (
        <Card key={i}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{f.fournisseur}</p>
              <p className="text-sm opacity-60">{f.montantHT} €</p>
            </div>

            <div className={f.retard ? "text-red-500" : "text-orange-400"}>
              {f.retard ? "En retard" : "À payer"}
            </div>
          </div>
        </Card>
      ))}

      {/* graphique simple */}
      <h2 className="text-lg font-semibold">📈 CA</h2>

      <Card>
        <div className="h-52">
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
        </div>
      </Card>

    </div>
  );

  // ================= FACTURES =================
  const Factures = () => (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">💸 Factures</h1>

      {data.aPayerList?.map((f: any, i: number) => (
        <Card key={i}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{f.fournisseur}</p>
              <p className="text-sm opacity-60">
                {f.montantHT} € • {f.echeance}
              </p>
            </div>

            <button className="px-3 py-1 bg-green-600 rounded-lg text-sm">
              OK
            </button>
          </div>
        </Card>
      ))}
    </div>
  );

  // ================= AJOUT =================
  const Ajouter = () => (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">➕ Ajouter facture</h1>

      <Card>
        <div className="space-y-3">
          <input className="w-full p-2 bg-black border border-zinc-700 rounded" placeholder="Fournisseur" />
          <input className="w-full p-2 bg-black border border-zinc-700 rounded" placeholder="Montant" />
          <input className="w-full p-2 bg-black border border-zinc-700 rounded" placeholder="Catégorie" />
          <input className="w-full p-2 bg-black border border-zinc-700 rounded" placeholder="Échéance" />

          <button className="w-full bg-green-600 p-2 rounded">
            Ajouter
          </button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="bg-black text-white min-h-screen p-4 pb-24">

      {/* CONTENT */}
      {tab === "home" && <Home />}
      {tab === "factures" && <Factures />}
      {tab === "ajouter" && <Ajouter />}

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 flex justify-around py-3">

        <button
          onClick={() => setTab("home")}
          className={`flex flex-col items-center ${
            tab === "home" ? "text-green-400" : "text-gray-500"
          }`}
        >
          🏠
          <span className="text-xs">Home</span>
        </button>

        <button
          onClick={() => setTab("factures")}
          className={`flex flex-col items-center ${
            tab === "factures" ? "text-green-400" : "text-gray-500"
          }`}
        >
          💸
          <span className="text-xs">Factures</span>
        </button>

        <button
          onClick={() => setTab("ajouter")}
          className={`flex flex-col items-center ${
            tab === "ajouter" ? "text-green-400" : "text-gray-500"
          }`}
        >
          ➕
          <span className="text-xs">Ajouter</span>
        </button>

      </div>

    </div>
  );
}
