import React, { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Client, Project } from "../types";
import { Users, UserPlus, Phone, Mail, Building2, ChevronRight, History, Calendar, CheckSquare } from "lucide-react";
import { getUniqueClients, getClientMapping } from "../utils/clients";
import { formatARS } from "../utils/format";

interface ClientsManagerProps {
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  isAdmin: boolean;
  projects: Project[];
  clients: Client[];
  onLogAction: (actionName: string, description: string) => void;
}

export default function ClientsManager({ userEmail, userName, isAdmin, projects, clients, onLogAction }: ClientsManagerProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // New Client Form inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Deduplicate clients across potential duplicates in the DB
  const uniqueClients = getUniqueClients(clients);
  const clientMapping = getClientMapping(clients);

  useEffect(() => {
    if (uniqueClients.length > 0 && !selectedClientId) {
      setSelectedClientId(uniqueClients[0].id);
    }
  }, [uniqueClients, selectedClientId]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow empty fields with graceful fallbacks
    const finalName = name.trim() || "S/N (Sin Nombre)";
    const finalCompany = company.trim() || "Particular";
    const finalEmail = email.trim() ? email.trim().toLowerCase() : "sin-correo@unke.design";
    const finalPhone = phone.trim() || "-";

    const id = "cli-" + Math.random().toString(36).substr(2, 9);
    const path = `clients/${id}`;
    const newClient: Client = {
      id,
      name: finalName,
      company: finalCompany,
      email: finalEmail,
      phone: finalPhone,
      createdAt: new Date().toISOString(),
      createdBy: userEmail || "unknown"
    };

    try {
      await setDoc(doc(db, "clients", id), newClient);
      setSelectedClientId(id);
      
      // Reset inputs
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setShowAddForm(false);

      // Log operation
      onLogAction("CREATE_CLIENT", `Creó el perfil de cliente recurrente: '${newClient.name}' (${newClient.company}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Filter unique clients based on search query
  const filteredClients = uniqueClients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = uniqueClients.find(c => c.id === selectedClientId);
  
  // Find projects belonging to the selected client (or its duplicates via client mapping)
  const clientHistory = projects.filter(p => {
    const parentCanonical = clientMapping[p.clientId] || p.clientId;
    const selectedCanonical = selectedClientId ? (clientMapping[selectedClientId] || selectedClientId) : "";
    return parentCanonical === selectedCanonical;
  }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Calculate high-level stats for selected client
  const clientTotalSpent = clientHistory.reduce((sum, p) => p.status === "completed" || p.status === "approved" || p.status === "in_progress" ? sum + p.price : sum, 0);
  const clientActiveJobs = clientHistory.filter(p => ["approved", "in_progress", "revision"].includes(p.status)).length;

  return (
    <div id="clients-dashboard" className="space-y-4 animate-fadeIn">
      <div className="flex md:flex-row flex-col gap-2.5 items-start md:items-center justify-between bg-white p-2.5 rounded-lg border border-neutral-200">
        <div className="flex bg-neutral-150 border border-neutral-200 p-1 rounded-md w-full max-w-xs shadow-none">
          <span className="flex items-center pl-2 text-neutral-400">
            <Users className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Buscar por cliente o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-2 pr-3 py-0.5 bg-transparent border-0 text-[11px] focus:ring-0 focus:outline-none"
          />
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 bg-neutral-950 hover:bg-neutral-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-md transition shrink-0 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo Perfil Cliente
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Left Side: Client profile directories */}
        <div className="md:col-span-1 space-y-3">
          {showAddForm && (
            <form onSubmit={handleAddClient} className="bg-white border border-neutral-200 rounded-lg p-3.5 space-y-3 shadow-none">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-neutral-800">Agregar Cliente</h4>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 font-bold uppercase"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Nombre Completo</label>
                  <input
                    type="text"
                    placeholder="Ej. Martín Rivas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Empresa / Razón Social</label>
                  <input
                    type="text"
                    placeholder="Ej. Bodega Los Andes / Particular"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Correo Electrónico</label>
                  <input
                    type="text"
                    placeholder="Escribre correo para notificaciones..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Teléfono Móvil</label>
                  <input
                    type="tel"
                    placeholder="Ej. +54 9 261 543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-neutral-900 text-white font-bold py-2 rounded-md text-xs hover:bg-neutral-800 transition"
              >
                Registrar Cliente
              </button>
            </form>
          )}

          <div className="bg-white border border-neutral-200 rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Directorio ({filteredClients.length})</span>
            </div>

            {filteredClients.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400">No se encontraron perfiles de clientes</div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={`w-full text-left p-2 px-2.5 flex items-center justify-between transition-colors ${
                      selectedClientId === c.id ? "bg-neutral-900 text-white" : "hover:bg-neutral-50 text-neutral-800"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs leading-none">{c.name}</div>
                      <div className={`text-[10px] mt-1 ${selectedClientId === c.id ? "text-neutral-400" : "text-neutral-500"}`}>
                        {c.company} • {c.email}
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 ${selectedClientId === c.id ? "text-neutral-400" : "text-neutral-300"}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Client details and histories */}
        <div className="md:col-span-2 space-y-3">
          {selectedClient ? (
            <div className="space-y-3">
              <div className="bg-white border border-neutral-200 rounded-md p-3.5 shadow-none space-y-3">
                <div className="border-b border-neutral-100 pb-2 flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-905">{selectedClient.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                      <Building2 className="h-3 w-3 text-neutral-400 shrink-0" />
                      <span>{selectedClient.company}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-neutral-400 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded font-mono">
                    ID: {selectedClient.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded border border-neutral-250">
                    <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase">Email</div>
                      <a href={`mailto:${selectedClient.email}`} className="text-neutral-800 hover:underline">{selectedClient.email}</a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded border border-neutral-250">
                    <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase">Teléfono</div>
                      <span className="text-neutral-800">{selectedClient.phone || "Sin Registrar"}</span>
                    </div>
                  </div>
                </div>

                {/* KPI metrics for this client */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-neutral-50 border border-neutral-200 p-2 rounded-md">
                    <div className="text-[9px] font-extrabold uppercase text-neutral-400 tracking-wider">Facturado / Estimado</div>
                    <div className="text-sm font-extrabold text-neutral-900 mt-0.5">{formatARS(clientTotalSpent)}</div>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2 rounded-md">
                    <div className="text-[9px] font-extrabold uppercase text-neutral-400 tracking-wider">Trabajos Activos</div>
                    <div className="text-sm font-extrabold text-neutral-950 mt-0.5">{clientActiveJobs} proyectos</div>
                  </div>
                </div>
              </div>

              {/* History list */}
              <div className="bg-white border border-neutral-200 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b flex items-center gap-2 justify-between bg-neutral-50">
                  <div className="flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-neutral-500" />
                    <span className="font-bold text-[10px] text-neutral-800 uppercase tracking-wider">Historial de Trabajos</span>
                  </div>
                  <span className="text-[9px] bg-neutral-900 text-white font-bold px-1.5 py-0.2 rounded">
                    {clientHistory.length}
                  </span>
                </div>

                {clientHistory.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-neutral-400">
                    Este cliente no posee trabajos anteriores cargados.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {clientHistory.map((proj) => (
                      <div key={proj.id} className="p-2.5 px-3 flex sm:flex-row flex-col sm:items-center justify-between hover:bg-neutral-50/50 transition gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-neutral-800">{proj.name}</span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.2 rounded-full ${
                              proj.status === "completed" ? "bg-green-100 text-green-800" :
                              proj.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                              proj.status === "revision" ? "bg-amber-100 text-amber-800" :
                              proj.status === "approved" ? "bg-purple-100 text-purple-800" :
                              "bg-neutral-100 text-neutral-800"
                            }`}>
                              {proj.status === "draft" ? "Draft" :
                               proj.status === "approved" ? "Aprov" :
                               proj.status === "in_progress" ? "Construyendo" :
                               proj.status === "revision" ? "Revisión" :
                               "Listo"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-center text-[10px] text-neutral-400">
                            <div className="flex items-center gap-1">
                              <CheckSquare className="h-3 w-3 text-neutral-300 shrink-0" />
                              <span>{proj.pieceType} (Cap. {proj.complexity})</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-neutral-300 shrink-0" />
                              <span>Entrega: {proj.deliveryDate ? new Date(proj.deliveryDate + "T00:00:00").toLocaleDateString("es-ES") : "Sin acordar"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="sm:text-right flex sm:flex-col flex-row sm:items-end justify-between items-center bg-neutral-50 sm:bg-transparent p-1.5 sm:p-0 rounded text-[10px]">
                          <span className="text-[9px] text-neutral-400 font-bold uppercase shrink-0">Total</span>
                          <span className="font-bold text-xs text-neutral-900">{formatARS(proj.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed rounded-lg p-10 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Users className="h-6 w-6 text-neutral-300" />
              <span>Selecciona un cliente del listado izquierdo para ver su ficha técnica, contactos y servicios anteriores de diseño.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
