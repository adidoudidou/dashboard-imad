"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Chargement...
      </div>
    );
  }

  // ================= HOME =================
  const Home = () => (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">📊 Dashboard</h1>

      <Card className="p-4">
        <p className="text-xs opacity-60">Bénéfice</p>
        <p className="text-3xl font-bold text-green-400">
          {Math.round(data.totalRevenus - data.totalDepenses)} €
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs opacity-60">CA</p>
          <p className="text-lg font-bold">{Math.round(data.totalRevenus)}€</p>
        </Card>

        <Card className="p-3">
          <p className="text-xs opacity-60">Dépenses</p>
          <p className="text-lg font-bold">{Math.round(data.totalDepenses)}€</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold">Objectif</p>
        <p className="text-xl">
          {data.progressionMois?.toFixed(1)} %
        </p>
      </Card>
    </div>
  );

  // ================= FACTURES =================
  const Factures = () => (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">💸 Factures</h1>

      {data.aPayerList?.map((f: any, i: number) => (
        <Card key={i} className="p-4 flex justify-between items-center">
          <div>
            <p className="font-semibold">{f.fournisseur}</p>
            <p className="text-sm opacity-60">{f.montantHT} €</p>
          </div>

          <div className={f.retard ? "text-red-500" : "text-orange-400"}>
            {f.retard ? "Urgent" : "À payer"}
          </div>
        </Card>
      ))}
    </div>
  );

  // ================= AJOUT =================
  const Ajouter = () => (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">➕ Ajouter</h1>

      <Card className="p-4 space-y-3">
        <input className="w-full p-2 bg-gray-800 rounded" placeholder="Fournisseur" />
        <input className="w-full p-2 bg-gray-800 rounded" placeholder="Montant" />
        <input className="w-full p-2 bg-gray-800 rounded" placeholder="Catégorie" />
        <input className="w-full p-2 bg-gray-800 rounded" placeholder="Échéance" />

        <button className="w-full bg-green-600 p-2 rounded">
          Ajouter facture
        </button>
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
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-700 flex justify-around py-3 z-50">

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
