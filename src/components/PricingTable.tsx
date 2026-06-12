import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { PricingItem } from "../types";
import { ShieldCheck, Plus, Edit3, Save, RotateCcw, HelpCircle, DollarSign } from "lucide-react";
import { formatARS, formatARSWithSign } from "../utils/format";

// Default seed list to populate the Firestore collection on initial load
const DEFAULT_PRICINGS: PricingItem[] = [
  { id: "logo", pieceName: "Identidad Visual / Logotipo", basePrice: 350, factorLow: 1.0, factorMedium: 1.4, factorHigh: 2.0 },
  { id: "web", pieceName: "Sitio Web (Landing Page)", basePrice: 600, factorLow: 1.0, factorMedium: 1.5, factorHigh: 2.2 },
  { id: "social", pieceName: "Kit Redes Sociales (12 piezas)", basePrice: 200, factorLow: 1.0, factorMedium: 1.3, factorHigh: 1.8 },
  { id: "flyer", pieceName: "Folleto / Poster / Flyer", basePrice: 90, factorLow: 1.0, factorMedium: 1.4, factorHigh: 1.9 },
  { id: "packaging", pieceName: "Packaging / Etiqueta de Producto", basePrice: 280, factorLow: 1.0, factorMedium: 1.5, factorHigh: 2.1 },
  { id: "branding", pieceName: "Branding Completo Estudio UNKE", basePrice: 1200, factorLow: 1.0, factorMedium: 1.4, factorHigh: 2.0 },
  { id: "cards", pieceName: "Tarjetas de Presentación / Papelería", basePrice: 80, factorLow: 1.0, factorMedium: 1.2, factorHigh: 1.7 }
];

interface PricingTableProps {
  userEmail: string | null | undefined;
  isAdmin: boolean;
  onLogAction: (actionName: string, description: string) => void;
}

export default function PricingTable({ userEmail, isAdmin, onLogAction }: PricingTableProps) {
  const [pricings, setPricings] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // States for new item creation
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPieceName, setNewPieceName] = useState("");
  const [newBasePrice, setNewBasePrice] = useState(150);
  const [newFactorLow, setNewFactorLow] = useState(1.0);
  const [newFactorMedium, setNewFactorMedium] = useState(1.4);
  const [newFactorHigh, setNewFactorHigh] = useState(2.0);

  // States for editing rows
  const [editBasePrice, setEditBasePrice] = useState<number>(0);
  const [editFactorLow, setEditFactorLow] = useState<number>(1.0);
  const [editFactorMedium, setEditFactorMedium] = useState<number>(1.4);
  const [editFactorHigh, setEditFactorHigh] = useState<number>(2.0);

  // Simulation parameters for real-time calculations
  const [simPiece, setSimPiece] = useState<string>("");
  const [simComplexity, setSimComplexity] = useState<"low" | "medium" | "high">("medium");
  const [simQuantity, setSimQuantity] = useState<number>(1);
  const [simAdjustment, setSimAdjustment] = useState<number>(0);

  const fetchPricings = async () => {
    setLoading(true);
    const path = "pricings";
    try {
      const snap = await getDocs(collection(db, path));
      if (snap.empty) {
        // Seed database
        for (const item of DEFAULT_PRICINGS) {
          await setDoc(doc(db, "pricings", item.id), item);
        }
        setPricings(DEFAULT_PRICINGS);
        
        // Log action
        onLogAction("SEED_PRICINGS", "Inicializó la lista de precios por defecto del sistema.");
      } else {
        const list: PricingItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as PricingItem);
        });
        setPricings(list);
        if (list.length > 0) {
          setSimPiece(list[0].id);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricings();
  }, []);

  const handleStartEdit = (item: PricingItem) => {
    if (!isAdmin) return;
    setEditingId(item.id);
    setEditBasePrice(item.basePrice);
    setEditFactorLow(item.factorLow);
    setEditFactorMedium(item.factorMedium);
    setEditFactorHigh(item.factorHigh);
  };

  const handleSaveEdit = async (id: string, originalName: string) => {
    if (!isAdmin) return;
    const path = `pricings/${id}`;
    try {
      const docRef = doc(db, "pricings", id);
      await updateDoc(docRef, {
        basePrice: Number(editBasePrice),
        factorLow: Number(editFactorLow),
        factorMedium: Number(editFactorMedium),
        factorHigh: Number(editFactorHigh)
      });

      setPricings(pricings.map(item => item.id === id ? {
        ...item,
        basePrice: Number(editBasePrice),
        factorLow: Number(editFactorLow),
        factorMedium: Number(editFactorMedium),
        factorHigh: Number(editFactorHigh)
      } : item));
      
      setEditingId(null);
      onLogAction("UPDATE_PRICING", `Actualizó los valores de cotización de '${originalName}' (Nueva base: ${formatARS(editBasePrice)}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleAddNewPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newPieceName.trim()) return;
    
    const id = newPieceName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const path = `pricings/${id}`;
    const newItem: PricingItem = {
      id,
      pieceName: newPieceName.trim(),
      basePrice: Number(newBasePrice),
      factorLow: Number(newFactorLow),
      factorMedium: Number(newFactorMedium),
      factorHigh: Number(newFactorHigh)
    };

    try {
      await setDoc(doc(db, "pricings", id), newItem);
      setPricings([...pricings, newItem]);
      
      // Reset State
      setShowAddForm(false);
      setNewPieceName("");
      setNewBasePrice(150);
      setNewFactorLow(1.0);
      setNewFactorMedium(1.4);
      setNewFactorHigh(2.0);

      onLogAction("CREATE_PRICING", `Creó una nueva pieza tarifaria: '${newItem.pieceName}' con costo base de ${formatARS(newItem.basePrice)}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Simulating calculations based on parameters
  const selectedItem = pricings.find(p => p.id === simPiece);
  let computedSingle = 0;
  let formulaDisplay = "-";
  if (selectedItem) {
    const multiplier = simComplexity === "low" ? selectedItem.factorLow : simComplexity === "medium" ? selectedItem.factorMedium : selectedItem.factorHigh;
    computedSingle = Math.round(selectedItem.basePrice * multiplier);
    formulaDisplay = `${formatARS(selectedItem.basePrice)} (Base) × ${multiplier} (Complejidad ${simComplexity === "low" ? "Baja" : simComplexity === "medium" ? "Media" : "Alta"})`;
  }
  const totalSimulated = Math.max(0, computedSingle * simQuantity + Number(simAdjustment));

  return (
    <div id="pricing-settings" className="space-y-4">
      {/* Banner de roles (Slim High Density) */}
      <div className="bg-white border border-neutral-200 rounded-md p-2.5 flex items-center justify-between sm:flex-row flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-neutral-100 text-neutral-800 p-1.5 rounded">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-800 text-[11px] uppercase tracking-wider">Tarifario Administrativo</h3>
            <p className="text-[10px] text-neutral-500">
              {isAdmin ? "Tienes acceso completo para modificar tarifas y coeficientes." : "Visualización de solo lectura. Solicita permisos a Willy."}
            </p>
          </div>
        </div>
        {isAdmin && !showAddForm && (
          <button
            id="add-piece-btn"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 bg-neutral-950 hover:bg-neutral-800 text-white px-2.5 py-1 rounded text-[10px] font-bold transition shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Pieza de Diseño
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neutral-900"></div>
          <span className="ml-2 text-xs text-neutral-500">Cargando tarifario UNKE...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Formulario para agregar / Lista de precios */}
          <div className="col-span-1 lg:col-span-2 space-y-3">
            
            {showAddForm && (
              <form onSubmit={handleAddNewPiece} id="new-pricing-form" className="bg-white border border-neutral-200 rounded-lg p-3.5 space-y-3 shadow-none animate-fadeIn">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                  <h4 className="font-bold text-[11px] text-neutral-800 uppercase tracking-wider">Agregar Nueva Pieza Tarifaria</h4>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="text-[10px] text-neutral-400 hover:text-neutral-600 font-bold uppercase"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-0.5">Nombre de la Pieza / Entregable</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Diseño de Packaging Premium"
                      value={newPieceName}
                      onChange={(e) => setNewPieceName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-0.5">Precio Base (en miles de pesos)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={newBasePrice}
                      onChange={(e) => setNewBasePrice(Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-400 mb-0.5">Mult. Baja</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.5"
                      value={newFactorLow}
                      onChange={(e) => setNewFactorLow(Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-400 mb-0.5">Mult. Media</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.5"
                      value={newFactorMedium}
                      onChange={(e) => setNewFactorMedium(Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-400 mb-0.5">Mult. Alta</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.5"
                      value={newFactorHigh}
                      onChange={(e) => setNewFactorHigh(Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-neutral-900 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-neutral-800 transition"
                  >
                    Guardar Nueva Pieza
                  </button>
                </div>
              </form>
            )}

            {/* Listado de tarifas */}
            <div className="bg-white border border-neutral-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50">
                <h4 className="font-bold text-[11px] text-neutral-800 uppercase tracking-wider">Catálogo de Piezas Estimadas</h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse-collapse">
                  <thead>
                    <tr className="bg-neutral-100/80 text-neutral-500 text-[9px] font-extrabold uppercase tracking-wider border-b border-neutral-200">
                      <th className="px-3 py-2">Detalle Pieza</th>
                      <th className="px-2 py-2">Precio Base</th>
                      <th className="px-2 py-2 text-center">Mult. Baja</th>
                      <th className="px-2 py-2 text-center">Mult. Media</th>
                      <th className="px-2 py-2 text-center">Mult. Alta</th>
                      {isAdmin && <th className="px-3 py-2 text-right">Fijar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150 text-xs text-neutral-800">
                    {pricings.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-3 py-1.5 font-bold text-neutral-800">
                            {p.pieceName}
                          </td>
                          <td className="px-2 py-1.5 text-neutral-600 font-mono">
                            {isEditing ? (
                              <div className="flex items-center bg-white border border-neutral-300 rounded px-1.5 py-0.5 w-16">
                                <span className="text-neutral-405 mr-0.5">$</span>
                                <input
                                  type="number"
                                  value={editBasePrice}
                                  onChange={(e) => setEditBasePrice(Number(e.target.value))}
                                  className="w-full focus:outline-none text-[10px]"
                                />
                              </div>
                            ) : (
                              formatARS(p.basePrice)
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-neutral-600 font-mono text-[11px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={editFactorLow}
                                onChange={(e) => setEditFactorLow(Number(e.target.value))}
                                className="w-12 border rounded px-1.5 py-0.5 text-[10px] text-center focus:outline-none"
                              />
                            ) : (
                              `x${p.factorLow}`
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-neutral-600 font-mono text-[11px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={editFactorMedium}
                                onChange={(e) => setEditFactorMedium(Number(e.target.value))}
                                className="w-12 border rounded px-1.5 py-0.5 text-[10px] text-center focus:outline-none"
                              />
                            ) : (
                              `x${p.factorMedium}`
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-neutral-600 font-mono text-[11px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={editFactorHigh}
                                onChange={(e) => setEditFactorHigh(Number(e.target.value))}
                                className="w-12 border rounded px-1.5 py-0.5 text-[10px] text-center focus:outline-none"
                              />
                            ) : (
                              `x${p.factorHigh}`
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-1.5 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSaveEdit(p.id, p.pieceName)}
                                    className="p-1 text-green-605 hover:bg-green-50 rounded cursor-pointer"
                                    title="Guardar"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 text-neutral-400 hover:bg-neutral-100 rounded cursor-pointer"
                                    title="Descartar"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEdit(p)}
                                  className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                                  title="Editar pieza"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Calculadora Interactiva de Prueba */}
          <div className="col-span-1 space-y-3">
            <div className="bg-neutral-950 text-white rounded-md p-4 space-y-3.5 shadow-none sticky top-3 border border-neutral-900">
              <div className="border-b border-neutral-900 pb-2 flex items-center gap-1.5">
                <DollarSign className="text-unke h-4 w-4" />
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-unke-light">Cotizador Instantáneo</h4>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Pieza de Diseño</label>
                  <select
                    value={simPiece}
                    onChange={(e) => setSimPiece(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
                  >
                    {pricings.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pieceName} ({formatARS(p.basePrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Complejidad Requerida</label>
                  <div className="grid grid-cols-3 gap-1 bg-neutral-900 p-1 rounded border border-neutral-850">
                    {["low", "medium", "high"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSimComplexity(c as any)}
                        className={`text-[9px] py-1 rounded font-bold capitalize transition cursor-pointer ${
                          simComplexity === c
                            ? "bg-unke text-white"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {c === "low" ? "Baja" : c === "medium" ? "Media" : "Alta"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={simQuantity}
                      onChange={(e) => setSimQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-neutral-900 border border-neutral-805 text-neutral-200 rounded px-2 py-1 text-[11px] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Ajuste Extra (miles $)</label>
                    <input
                      type="number"
                      placeholder="Ej. -50 / 100"
                      value={simAdjustment || ""}
                      onChange={(e) => setSimAdjustment(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-850 text-neutral-200 rounded px-2 py-1 text-[11px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Resultado del Presupuesto */}
              <div className="bg-neutral-900 border border-neutral-850 rounded p-3 space-y-1 text-center">
                <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Total Estimado Estimativo</span>
                <div className="text-2xl font-extrabold text-unke font-mono tracking-tight">{formatARS(totalSimulated)}</div>
                <div className="text-[9px] text-neutral-400 font-mono italic truncate">
                  Fórmula: {formulaDisplay} x {simQuantity}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
