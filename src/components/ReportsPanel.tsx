import React from "react";
import { Project } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, FileText, CheckCircle, Clock, DollarSign, BarChart2 } from "lucide-react";
import { formatARS } from "../utils/format";

interface ReportsPanelProps {
  projects: Project[];
}

export default function ReportsPanel({ projects }: ReportsPanelProps) {
  // 1. Calculations metrics
  const totalProjectsCount = projects.length;
  
  const completedProjects = projects.filter(p => p.status === "completed");
  const completedRevenues = completedProjects.reduce((sum, p) => sum + p.price, 0);

  const activeProjects = projects.filter(p => ["approved", "in_progress", "revision"].includes(p.status));
  const activeRevenues = activeProjects.reduce((sum, p) => sum + p.price, 0);

  const draftProjects = projects.filter(p => p.status === "draft");
  const draftEstValue = draftProjects.reduce((sum, p) => sum + p.price, 0);

  // 2. Monthly dynamic grouping (Spanish Month shortnames)
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  // Grouping revenues by month
  const monthlyDataMap: { [key: string]: { month: string; completado: number; enProceso: number; total: number } } = {};
  
  projects.forEach((proj) => {
    const date = new Date(proj.createdAt);
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const monthLabel = `${monthNames[monthIndex]} ${String(year).slice(-2)}`;

    if (!monthlyDataMap[key]) {
      monthlyDataMap[key] = { month: monthLabel, completado: 0, enProceso: 0, total: 0 };
    }

    if (proj.status === "completed") {
      monthlyDataMap[key].completado += proj.price;
    } else if (["approved", "in_progress", "revision"].includes(proj.status)) {
      monthlyDataMap[key].enProceso += proj.price;
    }
    monthlyDataMap[key].total += proj.price;
  });

  const monthlyChartData = Object.keys(monthlyDataMap)
    .sort() // chronological sort
    .slice(-6) // last 6 months
    .map(key => monthlyDataMap[key]);

  // If no data yet, create a default mock/placeholder for last 3 months so the graph doesn't render completely blank
  const displaysChartData = monthlyChartData.length > 0 ? monthlyChartData : [
    { month: "Abr 26", completado: 850, enProceso: 420, total: 1270 },
    { month: "May 26", completado: 1200, enProceso: 600, total: 1800 },
    { month: "Jun 26", completado: 1500, enProceso: 900, total: 2400 }
  ];

  // 3. Distribution by Status counts
  const statusCounts: { [key: string]: number } = {
    "borrador": projects.filter(p => p.status === "draft").length,
    "aprobado": projects.filter(p => p.status === "approved").length,
    "en proceso": projects.filter(p => p.status === "in_progress").length,
    "en revisión": projects.filter(p => p.status === "revision").length,
    "entregado": projects.filter(p => p.status === "completed").length,
  };

  const statusPieData = Object.keys(statusCounts).map(name => ({
    name,
    value: statusCounts[name]
  })).filter(item => item.value > 0);

  const fallbackPieData = [
    { name: "Borrador", value: 2 },
    { name: "Aprobado", value: 3 },
    { name: "En proceso", value: 5 },
    { name: "En revisión", value: 1 },
    { name: "Entregado", value: 6 }
  ];

  const actualPieData = statusPieData.length > 0 ? statusPieData : fallbackPieData;

  const COLORS = ["#737373", "#78b5ad", "#2D8276", "#1E554D", "#171717"];

  return (
    <div id="financial-reports" className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-3xs uppercase font-extrabold text-neutral-400 tracking-wider">Facturado Cobrado</span>
            <div className="text-xl font-extrabold text-neutral-900">{formatARS(completedRevenues)}</div>
            <p className="text-3xs text-neutral-500">De proyectos terminados</p>
          </div>
          <div className="bg-green-50 p-2.5 rounded-lg border border-green-100 text-green-600">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-3xs uppercase font-extrabold text-neutral-400 tracking-wider">En Ejecución (Activos)</span>
            <div className="text-xl font-extrabold text-neutral-900">{formatARS(activeRevenues)}</div>
            <p className="text-3xs text-neutral-500">Cartera aprobada en proceso</p>
          </div>
          <div className="bg-orange-50 p-2.5 rounded-lg border border-orange-100 text-neutral-900">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-3xs uppercase font-extrabold text-neutral-400 tracking-wider">Bocetado / En Espera</span>
            <div className="text-xl font-extrabold text-neutral-900">{formatARS(draftEstValue)}</div>
            <p className="text-3xs text-neutral-500">Presupuestos borrador</p>
          </div>
          <div className="bg-neutral-50 p-2.5 rounded-lg border text-neutral-400">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-3xs uppercase font-extrabold text-neutral-400 tracking-wider">Proyectos Totales</span>
            <div className="text-xl font-extrabold text-neutral-900">{totalProjectsCount} <span className="text-2xs text-neutral-400 font-normal">trabajos</span></div>
            <p className="text-3xs text-neutral-500">Histórico completo</p>
          </div>
          <div className="bg-neutral-900 text-neutral-100 p-2.5 rounded-lg border">
            <BarChart2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Gráficos Visuales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly Revenues graph (Bar chart) */}
        <div className="md:col-span-2 bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-xs text-neutral-800 uppercase tracking-wide">Evolución de Ingresos Mensuales</h3>
            <p className="text-3xs text-neutral-400">Acumulado mensual de cotizaciones completadas vs volumen en proceso (ARS)</p>
          </div>

          <div className="h-64 mt-4 text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displaysChartData} margin={{ top: 10, right: 5, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="month" tickLine={false} stroke="#a3a3a3" style={{ fontSize: "10px" }} />
                <YAxis tickLine={false} tickFormatter={(val) => formatARS(val)} stroke="#a3a3a3" style={{ fontSize: "9px" }} />
                <Tooltip 
                  cursor={{ fill: "rgba(100,100,100,0.03)" }}
                  contentStyle={{ backgroundColor: "#171717", borderRadius: "8px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#78b5ad", fontSize: "11px" }}
                  formatter={(val: any) => [formatARS(Number(val)), "Monto"]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", margin: "10px 0 0" }} />
                <Bar name="Entregado (Cobrado)" dataKey="completado" fill="#1E554D" radius={[4, 4, 0, 0]} />
                <Bar name="En Proceso" dataKey="enProceso" fill="#2D8276" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {projects.length === 0 && (
            <p className="text-2xs text-center text-neutral-400 italic bg-unke-light p-2 rounded border border-unke-border text-unke-dark/85">
              * Mostrando simulación de referencia. Los datos del estudio comenzarán a graficarse apenas crees proyectos y muevas sus estados.
            </p>
          )}
        </div>

        {/* Status Distribution (Pie chart) */}
        <div className="col-span-1 bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-xs text-neutral-800 uppercase tracking-wide">Distribución de Proyectos</h3>
            <p className="text-3xs text-neutral-400">Proporción de trabajos según su fase de avance actual</p>
          </div>

          <div className="h-56 relative flex items-center justify-center font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={actualPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {actualPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "6px" }} />
              </PieChart>
            </ResponsiveContainer>

            {/* Absolute total counter inside pie */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-2xl font-black text-neutral-800">
                {projects.length || 17}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-extrabold">Trabajos</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
            {actualPieData.slice(0, 4).map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="w-2 h-2 rounded-full block shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="truncate capitalize text-3xs font-semibold">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
