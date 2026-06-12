import React, { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getAccessToken } from "../firebase";
import { Project, Client, PricingItem, ProjectStatus, BudgetPieceItem } from "../types";
import { generateBudgetPDF } from "../utils/pdf";
import { getOrCreateDriveFolder, uploadPdfToDrive } from "../utils/drive";
import { sendGmailNotification } from "../utils/gmail";
import { formatARS } from "../utils/format";
import { 
  FileText, Plus, Calendar, CheckSquare, DollarSign, Upload, Mail, CheckCircle2, 
  Trash2, Filter, AlertCircle, ArrowUpRight, Check, Eye 
} from "lucide-react";

interface ProjectsTrackerProps {
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  isAdmin: boolean;
  projects: Project[];
  clients: Client[];
  onLogAction: (actionName: string, description: string) => void;
  onRefreshProjects: () => void;
}

export default function ProjectsTracker({
  userEmail,
  userName,
  isAdmin,
  projects,
  clients,
  onLogAction,
  onRefreshProjects
}: ProjectsTrackerProps) {
  const [pricings, setPricings] = useState<PricingItem[]>([]);
  const [loadingPricings, setLoadingPricings] = useState(true);

  // Filter and view states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Project states
  const [showAddForm, setShowAddForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  
  // Custom temporary client fields if they create a client on-the-fly or don't match recurring list
  const [customClientName, setCustomClientName] = useState("");
  const [customClientEmail, setCustomClientEmail] = useState("");

  const [selectedPieceId, setSelectedPieceId] = useState("");
  const [selectedComplexity, setSelectedComplexity] = useState<"low" | "medium" | "high">("medium");
  const [quantity, setQuantity] = useState(1);
  const [customAdjustment, setCustomAdjustment] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  // Added pieces configuration for multiple items
  const [addedPieces, setAddedPieces] = useState<BudgetPieceItem[]>([]);

  // Dynamic calculations state
  const [calculatedPrice, setCalculatedPrice] = useState(0);

  // Drive & Gmail async loaders per project mapping to avoid layout freezing
  const [loadingDriveId, setLoadingDriveId] = useState<string | null>(null);
  const [sendingGmailId, setSendingGmailId] = useState<string | null>(null);

  const fetchPricings = async () => {
    setLoadingPricings(true);
    const path = "pricings";
    try {
      const snap = await getDocs(collection(db, path));
      const list: PricingItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as PricingItem);
      });
      setPricings(list);
      if (list.length > 0) {
        setSelectedPieceId(list[0].id);
      }
    } catch (err) {
      console.error("Error reading pricings inside scheduler:", err);
    } finally {
      setLoadingPricings(false);
    }
  };

  const handleAddPieceToBudget = () => {
    const piece = pricings.find(p => p.id === selectedPieceId);
    if (!piece) return;

    const multiplier = selectedComplexity === "low" ? piece.factorLow : selectedComplexity === "medium" ? piece.factorMedium : piece.factorHigh;
    const baseSub = Math.round(piece.basePrice * multiplier);
    const itemPrice = Math.max(0, baseSub * quantity + Number(customAdjustment));

    const newItem: BudgetPieceItem = {
      id: "item-" + Math.random().toString(36).substr(2, 9),
      pieceId: piece.id,
      pieceName: piece.pieceName,
      complexity: selectedComplexity,
      quantity,
      customAdjustment: Number(customAdjustment),
      price: itemPrice
    };

    setAddedPieces(prev => [...prev, newItem]);
    
    // Reset quantity and custom adjustment so they can keep adding
    setQuantity(1);
    setCustomAdjustment(0);
  };

  const handleRemovePieceFromBudget = (itemId: string) => {
    setAddedPieces(prev => prev.filter(item => item.id !== itemId));
  };

  useEffect(() => {
    fetchPricings();
  }, []);

  // recalculate price whenever metrics or added pieces shift
  useEffect(() => {
    if (addedPieces.length > 0) {
      const sum = addedPieces.reduce((total, item) => total + item.price, 0);
      setCalculatedPrice(sum);
    } else {
      const piece = pricings.find(p => p.id === selectedPieceId);
      if (piece) {
        const multiplier = selectedComplexity === "low" ? piece.factorLow : selectedComplexity === "medium" ? piece.factorMedium : piece.factorHigh;
        const baseSub = Math.round(piece.basePrice * multiplier);
        const totalCost = Math.max(0, baseSub * quantity + Number(customAdjustment));
        setCalculatedPrice(totalCost);
      }
    }
  }, [selectedPieceId, selectedComplexity, quantity, customAdjustment, pricings, addedPieces]);

  // Handle client select change
  const handleClientSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedClientId(val);
    if (val !== "new") {
      const matched = clients.find(c => c.id === val);
      if (matched) {
        setCustomClientName("");
        setCustomClientEmail("");
      }
    }
  };

  // Submit project creation
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    if (!customNotes.trim()) {
      alert("Por favor, ingresa las indicaciones de diseño internas antes de registrar el presupuesto (campo obligatorio).");
      return;
    }

    let finalClientId = selectedClientId;
    let finalClientName = "";
    let finalClientEmail = "";

    if (selectedClientId === "new") {
      const finalCustomName = customClientName.trim() || "S/N (Sin Nombre)";
      const finalCustomEmail = customClientEmail.trim() ? customClientEmail.trim().toLowerCase() : "sin-correo@unke.design";
      // Store on-the-fly client as recurring client so both lists sync up! Perfect experience.
      const id = "cli-" + Math.random().toString(36).substr(2, 9);
      try {
        await setDoc(doc(db, "clients", id), {
          id,
          name: finalCustomName,
          company: "Particular",
          email: finalCustomEmail,
          phone: "-",
          createdAt: new Date().toISOString(),
          createdBy: userEmail || "unknown"
        });
        finalClientId = id;
        finalClientName = finalCustomName;
        finalClientEmail = finalCustomEmail;
        onLogAction("CREATE_CLIENT", `Creó cliente de paso: '${finalClientName}' durante creación de presupuesto.`);
      } catch (err) {
        console.error("Failed creating dynamic client profile", err);
      }
    } else {
      const matched = clients.find(c => c.id === selectedClientId);
      if (matched) {
        finalClientName = matched.name;
        finalClientEmail = matched.email;
      } else {
        alert("Selecciona un cliente válido para el presupuesto.");
        return;
      }
    }

    const finalPieces: BudgetPieceItem[] = addedPieces.length > 0 ? addedPieces : (
      (() => {
        const piece = pricings.find(p => p.id === selectedPieceId);
        const pieceLabel = piece ? piece.pieceName : selectedPieceId;
        const itemPrice = calculatedPrice;
        return [{
          id: "item-default",
          pieceId: selectedPieceId,
          pieceName: pieceLabel,
          complexity: selectedComplexity,
          quantity,
          customAdjustment: Number(customAdjustment),
          price: itemPrice
        }];
      })()
    );

    let finalPieceType = "";
    if (finalPieces.length > 1) {
      finalPieceType = `${finalPieces.length} Piezas en Catálogo`;
    } else {
      finalPieceType = finalPieces[0].pieceName;
    }

    const projectId = "proj-" + Math.random().toString(36).substr(2, 9);
    const path = `projects/${projectId}`;

    const newProject: Project = {
      id: projectId,
      name: projectName.trim(),
      clientId: finalClientId,
      clientName: finalClientName,
      clientEmail: finalClientEmail,
      pieceType: finalPieceType,
      complexity: finalPieces[0].complexity,
      quantity: finalPieces.reduce((sum, p) => sum + p.quantity, 0),
      customAdjustment: finalPieces.reduce((sum, p) => sum + p.customAdjustment, 0),
      price: calculatedPrice,
      deliveryDate: deliveryDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // default 14 days
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userEmail || "unknown",
      createdByName: userName || "Estudio UNKE",
      customNotes: customNotes.trim() || undefined,
      pieces: finalPieces
    };

    try {
      await setDoc(doc(db, "projects", projectId), newProject);
      
      // Cleanup Create Form state
      setShowAddForm(false);
      setProjectName("");
      setSelectedClientId("");
      setCustomClientName("");
      setCustomClientEmail("");
      setQuantity(1);
      setCustomAdjustment(0);
      setCustomNotes("");
      setAddedPieces([]);

      // Refresh parent collection state
      onRefreshProjects();

      // Log activity
      onLogAction("CREATE_PROJECT", `Creó presupuesto borrador: '${newProject.name}' para '${newProject.clientName}' por ${formatARS(newProject.price)}.`);
      alert("¡Presupuesto creado con éxito!");
    } catch (err: any) {
      console.error(err);
      alert("Error al registrar presupuesto: " + (err.message || String(err)));
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (project: Project, newStatus: ProjectStatus) => {
    if (!isAdmin) return;
    const path = `projects/${project.id}`;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      onRefreshProjects();
      
      // Convert state text for log readable structure
      let transText = "Borrador";
      if (newStatus === "approved") transText = "Aprobado";
      if (newStatus === "in_progress") transText = "En Proceso";
      if (newStatus === "revision") transText = "En Revisión";
      if (newStatus === "completed") transText = "Entregado / Completado";

      onLogAction("UPDATE_STATUS", `Modificó el estado del proyecto '${project.name}' a: '${transText}'. Operador: ${userName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Generate & Download PDF client-side
  const handleDownloadPDF = (project: Project) => {
    const matchedClient = clients.find(c => c.id === project.clientId);
    try {
      const blob = generateBudgetPDF(project, matchedClient);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `UNKE_Presupuesto_${project.name.replace(/[^A-Za-z0-9]/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onLogAction("GENERATE_PDF", `Generó y descargó copia PDF del presupuesto para '${project.name}'.`);
    } catch (err) {
      console.error("Falla generando PDF", err);
      alert("Error local al generar el archivo de presupuesto PDF.");
    }
  };

  // Upload to Google Drive
  const handleSyncToDrive = async (project: Project) => {
    // Require OAuth confirm check
    const token = await getAccessToken();
    if (!token) {
      alert("Necesitas conectar e iniciar sesión con Google para acceder a tu Google Drive.");
      return;
    }

    const conf = window.confirm(`¿Quieres generar el PDF y subirlo ordenadamente a tu Google Drive para '${project.clientName}'?`);
    if (!conf) return;

    setLoadingDriveId(project.id);
    const matchedClient = clients.find(c => c.id === project.clientId);

    try {
      // 1. Generate Blob
      const pdfBlob = generateBudgetPDF(project, matchedClient);
      
      // 2. Locate or create master UNKE folder
      const folderId = await getOrCreateDriveFolder(token, "UNKE Estudio - Presupuestos");
      
      // 3. Upload file
      const fileName = `UNKE_Presupuesto_${project.id.slice(0, 6).toUpperCase()}_${project.name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      const driveDetails = await uploadPdfToDrive(token, pdfBlob, fileName, folderId);

      // 4. Update project details in Firestore with drive link!
      await updateDoc(doc(db, "projects", project.id), {
        driveFileId: driveDetails.id,
        driveFileUrl: driveDetails.webViewLink,
        updatedAt: new Date().toISOString()
      });

      onRefreshProjects();

      onLogAction("SYNC_DRIVE", `Sincronizó y guardó PDF del presupuesto '${project.name}' en Google Drive (${fileName}).`);
      alert("Sincronización de Drive exitosa! Archivo ordenado en la carpeta 'UNKE Estudio - Presupuestos'.");
    } catch (err) {
      console.error("Google Drive API crash:", err);
      alert("Falla de API al sincronizar con Google Drive. Por favor vuelve a unirte completando permisos de Google Auth.");
    } finally {
      setLoadingDriveId(null);
    }
  };

  // Send Alert Gmail Notification
  const handleSendEmailNotification = async (project: Project) => {
    const token = await getAccessToken();
    if (!token) {
      alert("Necesitas de una autorización de Google para enviar notificaciones automáticas por correo electrónico.");
      return;
    }

    const matchedClient = clients.find(c => c.id === project.clientId);
    const targetEmail = matchedClient?.email || project.clientEmail;

    const conf = window.confirm(`¿Enviar alerta formal de notificacción por correo eletrónico a la dirección de cliente ${targetEmail}?`);
    if (!conf) return;

    setSendingGmailId(project.id);

    // Build email layout styled
    const emailSubject = `UNKE Estudio - Notificación sobre: ${project.name}`;
    
    let statusPhrase = "";
    let colorTheme = "#171717";
    if (project.status === "approved") {
      statusPhrase = "ha sido formalmente 🚨 <b>Aprobado</b> por nuestro equipo. El cronograma ya se encuentra activo.";
      colorTheme = "#7c3aed";
    } else if (project.status === "completed") {
      statusPhrase = "se encuentra 🏅 <b>Finalizado y Entregado</b>. En breve un diseñador te enviará el link con archivos vectoriales.";
      colorTheme = "#16a34a";
    } else if (project.status === "in_progress") {
      statusPhrase = "ya está ⚙️ <b>En proceso de ejecución</b> por los directores creativos.";
      colorTheme = "#2563eb";
    } else if (project.status === "revision") {
      statusPhrase = "ha sido enviado a 📋 <b>Revisión</b> para recibir tu feedback visual.";
      colorTheme = "#d97706";
    } else {
      statusPhrase = "cuenta con un nuevo presupuesto formal listo para tu análisis.";
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; color: #333333;">
        <div style="background-color: #171717; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">UNKE</h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; color: #a3a3a3; font-weight: bold;">Estudio de Diseño Gráfico</p>
        </div>
        
        <div style="padding: 24px; line-height: 1.6;">
          <h3 style="margin-top: 0; color: #171717;">Hola, ${project.clientName}</h3>
          
          <p>Te escribimos desde el estudio de diseño UNKE para informarte en tiempo real que tu proyecto <b>"${project.name}"</b> ${statusPhrase}</p>
          
          <div style="background-color: #f8f8fa; border-left: 4px solid ${colorTheme}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #767676; font-weight: bold;">Resumen del encargo</p>
            <table style="width: 100%; font-size: 13px;">
              <tr><td style="font-weight: bold; width: 110px;">Pieza Solicitada:</td><td>${project.pieceType}</td></tr>
              <tr><td style="font-weight: bold;">Complejidad:</td><td style="text-transform: capitalize;">${project.complexity === "low" ? "Baja" : project.complexity === "medium" ? "Media" : "Alta"}</td></tr>
              <tr><td style="font-weight: bold;">Fecha Entrega:</td><td>${project.deliveryDate ? new Date(project.deliveryDate + "T00:00:00").toLocaleDateString("es-ES") : "A coordinar"}</td></tr>
              <tr><td style="font-weight: bold;">Monto Cotizado:</td><td style="font-weight: bold; color: #171717;">${formatARS(project.price)}</td></tr>
            </table>
          </div>

          ${project.driveFileUrl ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${project.driveFileUrl}" target="_blank" style="background-color: #171717; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px;">Descargar Ficha en Google Drive</a>
            </div>
          ` : ""}

          <p style="font-size: 13px;">Si tienes alguna duda o quieres coordinar revisiones específicas sobre las piezas, ponte en contacto directo respondiendo este correo.</p>
          
          <p style="margin-bottom: 0; font-size: 13px;">Saludos cordiales,<br><b>Equipo UNKE (Willy, Nacho y Fede)</b></p>
        </div>

        <div style="background-color: #f5f5f5; padding: 16px; text-align: center; font-size: 11px; color: #767676; border-top: 1px solid #eaeaea;">
          Estudio UNKE • La Plata, Buenos Aires, Argentina • hola@unke.design • unke.design
        </div>
      </div>
    `;

    try {
      await sendGmailNotification(token, targetEmail, emailSubject, htmlBody);
      
      onLogAction("SEND_EMAIL", `Envió notificación Gmail al cliente '${project.clientName}' (${targetEmail}) sobre estado '${project.status}'.`);
      alert(`Correo de notificación enviado con éxito a ${targetEmail}!`);
    } catch (err) {
      console.error("failed sending Gmail alert", err);
      alert("Error al enviar el email por Gmail. Asegúrate de que el token de Google está configurado y el email de destino es válido.");
    } finally {
      setSendingGmailId(null);
    }
  };

  // Delete project
  const handleDeleteProject = async (id: string, name: string) => {
    if (!isAdmin) return;
    const c = window.confirm(`¿Estás completamente seguro de borrar el proyecto y presupuesto de '${name}'? Esta acción es irreversible.`);
    if (!c) return;

    const path = `projects/${id}`;
    try {
      await deleteDoc(doc(db, "projects", id));
      onRefreshProjects();
      onLogAction("DELETE_PROJECT", `Eliminó el proyecto del estudio: '${name}' permanentemente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Apply filters on list
  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesClient = clientFilter === "all" || p.clientId === clientFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.pieceType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesClient && matchesSearch;
  });

  return (
    <div id="projects-board" className="space-y-4">
      {/* Dense Filter & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white p-2.5 rounded-lg border border-neutral-200">
        {/* Search and Filters headers */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center bg-white border border-neutral-200 p-1 rounded-md w-full max-w-2xs shadow-none">
            <span className="text-neutral-400 pl-1"><Filter className="h-3.5 w-3.5 text-neutral-400" /></span>
            <input
              type="text"
              placeholder="Buscar proyectos, clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-1.5 w-full text-[11px] focus:ring-0 focus:outline-none focus:border-0 bg-transparent border-0 py-0.5"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-neutral-200 text-[11px] px-2 py-1.5 rounded-md text-neutral-600 focus:outline-none"
          >
            <option value="all">Todos los Estados</option>
            <option value="draft">Borrador / Creado</option>
            <option value="approved">Aprobado / Activo</option>
            <option value="in_progress">En ejecución</option>
            <option value="revision">En revisión</option>
            <option value="completed">Completado / Entregado</option>
          </select>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-white border border-neutral-200 text-[11px] px-2 py-1.5 rounded-md text-neutral-600 focus:outline-none max-w-xs"
          >
            <option value="all">Todos los Clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.company})
              </option>
            ))}
          </select>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 bg-neutral-950 hover:bg-neutral-800 text-white font-bold py-1.5 px-3 rounded-md text-[11px] tracking-wide transition shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo Presupuesto / Trabajo
          </button>
        )}
      </div>

      {loadingPricings ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neutral-950 mx-auto"></div>
          <span className="mt-2 text-xs text-neutral-400 block">Leyendo matriz de costos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Create Project Panel if toggled */}
          {showAddForm && (
            <div className="col-span-1 bg-white border border-neutral-200 rounded-lg p-3.5 shadow-sm flex flex-col space-y-3.5 animate-fadeIn md:sticky md:top-3 h-fit">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                <h4 className="font-bold text-[11px] text-neutral-800 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-neutral-500" />
                  Presupuestar Encargo
                </h4>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700 uppercase"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Nombre de la Pieza o Trabajo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Rediseño de Logo Bodega"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-neutral-50 px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5 font-sans">Cliente Destino *</label>
                  <select
                    required
                    value={selectedClientId}
                    onChange={handleClientSelectChange}
                    className="w-full bg-neutral-50 px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                    ))}
                    <option value="new">+ Registrar nuevo cliente en este momento</option>
                  </select>
                </div>

                {selectedClientId === "new" && (
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-2 text-2xs">
                    <span className="text-3xs font-extrabold text-neutral-500 block uppercase">Ficha Nuevo Cliente de Paso</span>
                    <div>
                      <input
                        type="text"
                        placeholder="Nombre Completo (ej. Juan Pérez)"
                        value={customClientName}
                        onChange={(e) => setCustomClientName(e.target.value)}
                        className="w-full bg-white px-2 py-1 border rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Correo de contacto (ej. juan@mail.com)"
                        value={customClientEmail}
                        onChange={(e) => setCustomClientEmail(e.target.value)}
                        className="w-full bg-white px-2 py-1 border rounded focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Tipo de Pieza del Catálogo *</label>
                  <select
                    value={selectedPieceId}
                    onChange={(e) => setSelectedPieceId(e.target.value)}
                    className="w-full bg-neutral-50 px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:outline-none"
                  >
                    {pricings.map((p) => (
                      <option key={p.id} value={p.id}>{p.pieceName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-1">Complejidad *</label>
                    <div className="grid grid-cols-3 gap-0.5 bg-neutral-100 p-0.5 rounded border">
                      {["low", "medium", "high"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedComplexity(c as any)}
                          className={`py-1 rounded text-3xs font-bold capitalize ${
                            selectedComplexity === c ? "bg-black text-white" : "text-neutral-500 hover:text-black"
                          }`}
                        >
                          {c === "low" ? "Baja" : c === "medium" ? "Media" : "Alta"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-1">Cantidad *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-neutral-50 px-2 py-1 border border-neutral-200 rounded focus:outline-none text-center font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Ajuste Manual (miles $)</label>
                    <input
                      type="number"
                      placeholder="Ej -100 ó +150"
                      value={customAdjustment || ""}
                      onChange={(e) => setCustomAdjustment(Number(e.target.value))}
                      className="w-full bg-neutral-50 px-2 py-1.5 border rounded focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">Entrega Coor. Entrega</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full bg-neutral-50 px-2 py-1 border rounded focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-150 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddPieceToBudget}
                    className="w-full bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-extrabold py-2 px-3 rounded-lg text-3xs uppercase tracking-wider flex items-center justify-center gap-1 transition active:scale-98"
                  >
                    <Plus className="h-3 w-3 text-unke font-black" />
                    + Sumar Pieza al Presupuesto
                  </button>
                  <p className="text-[10px] text-neutral-400 text-center italic">Carga los detalles arriba y presiona para incorporar múltiples piezas al mismo presupuesto</p>
                </div>

                {addedPieces.length > 0 && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 space-y-2 animate-fadeIn">
                    <span className="text-3xs font-extrabold text-neutral-500 block uppercase tracking-wide">Piezas Incorporadas ({addedPieces.length})</span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {addedPieces.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-3xs border border-neutral-150 p-2 rounded-md bg-white">
                          <div className="space-y-0.5 pr-2 truncate">
                            <span className="font-bold text-neutral-800 block truncate">{p.pieceName}</span>
                            <span className="text-neutral-405 text-[9px] block">
                              Comp: <span className="capitalize">{p.complexity === "low" ? "Baja" : p.complexity === "medium" ? "Media" : "Alta"}</span> • Qty: {p.quantity} {p.customAdjustment !== 0 ? `• Aj: ${formatARS(p.customAdjustment)}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-neutral-800">{formatARS(p.price)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePieceFromBudget(p.id)}
                              className="text-red-500 hover:text-red-700 font-extrabold transition text-4xs uppercase cursor-pointer"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-3xs font-extrabold uppercase tracking-wide text-neutral-400 mb-0.5">
                    Indicaciones de diseño internas <span className="text-red-500 font-sans normal-case animate-pulse">* (Obligatorio)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Escribir requerimiento tipográfico, colores o especificaciones..."
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full bg-neutral-50 px-2.5 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400"
                  ></textarea>
                </div>

                {/* Live pricing display */}
                <div className="bg-neutral-900 border text-white p-3.5 rounded-lg text-center font-mono space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold block">
                    {addedPieces.length > 0 ? "Presupuesto Total Reunido" : "Presupuesto Estimativo Final"}
                  </span>
                  <div className="text-2xl font-black text-unke">{formatARS(calculatedPrice)}</div>
                  <p className="text-[9px] text-neutral-400 italic">
                    {addedPieces.length > 0 
                      ? `${addedPieces.length} piezas sumadas en este presupuesto` 
                      : "Cálculo dinámico directo (presiona '+ Sumar Pieza al Presupuesto' para acumular más)"}
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-neutral-950 font-bold text-white py-2 rounded-lg text-xs hover:bg-neutral-800 transition"
                >
                  Registrar & Crear Presupuesto
                </button>
              </form>
            </div>
          )}

          {/* List content area */}
          <div className="lg:col-span-2 col-span-3 space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="bg-white border border-dashed rounded-lg p-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2 shadow-inner">
                <FileText className="h-6 w-6 text-neutral-300" />
                <span>No se registraron proyectos cargados. Presiona en &quot;Nuevo Presupuesto / Trabajo&quot; para crear tu primera estimación de diseño.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredProjects.map((proj) => {
                  const isSyncingToDrive = loadingDriveId === proj.id;
                  const isSendingEmail = sendingGmailId === proj.id;

                  const dateDiff = proj.deliveryDate 
                    ? Math.ceil((new Date(proj.deliveryDate + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <div key={proj.id} className="bg-white border border-neutral-200 hover:border-neutral-400 rounded-md p-3 flex flex-col justify-between space-y-3 shadow-none transition animate-fadeIn">
                      
                      {/* Top title bar */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[9px] uppercase text-neutral-400 font-extrabold tracking-wider bg-neutral-50 px-1.5 py-0.2 rounded border">
                            #{proj.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.2 rounded-full ${
                            proj.status === "completed" ? "bg-green-100 text-green-800" :
                            proj.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                            proj.status === "revision" ? "bg-amber-100 text-amber-800" :
                            proj.status === "approved" ? "bg-purple-100 text-purple-800" :
                            "bg-neutral-100 text-neutral-800"
                          }`}>
                            {proj.status === "draft" ? "Borrador" :
                             proj.status === "approved" ? "Aprobado" :
                             proj.status === "in_progress" ? "Construyendo" :
                             proj.status === "revision" ? "Revisión" :
                             "Entregado"}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-neutral-900 leading-tight line-clamp-1">{proj.name}</h4>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1 font-medium">
                          <span>Cliente: {proj.clientName}</span>
                        </div>
                      </div>

                      {/* Middle metadata blocks */}
                      <div className="border-t border-b border-neutral-100 py-1.5 gap-2 grid grid-cols-2 text-[10px] text-neutral-500 font-mono">
                        <div className="space-y-0.5">
                          <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px] block">Entrega</span>
                          <div className="flex items-center gap-1 font-bold text-neutral-800">
                            <Calendar className="h-3 w-3 text-neutral-400 shrink-0" />
                            <span>{proj.deliveryDate ? new Date(proj.deliveryDate + "T00:00:00").toLocaleDateString("es-ES") : "A acordar"}</span>
                          </div>
                          {proj.status !== "completed" && dateDiff !== null && (
                            <span className={`font-bold block text-[9px] ${dateDiff <= 3 ? "text-red-600" : dateDiff <= 7 ? "text-amber-600" : "text-green-600"}`}>
                              {dateDiff < 0 ? `Atrasado ${Math.abs(dateDiff)} d` : dateDiff === 0 ? "¡HOY!" : `Faltan ${dateDiff} d`}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px] block">Presupuesto</span>
                          <div className="flex items-center gap-0.5 font-bold text-neutral-900 font-mono">
                            <span>{formatARS(proj.price)}</span>
                          </div>
                          {proj.pieces && proj.pieces.length > 0 ? (
                            <div className="space-y-0.5 mt-1 max-h-16 overflow-y-auto">
                              {proj.pieces.map((p, idx) => (
                                <span key={idx} className="block text-[8px] bg-neutral-100 border text-neutral-600 px-1 py-0.2 rounded w-fit capitalize font-sans leading-none truncate max-w-full">
                                  • {p.pieceName} (x{p.quantity})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-neutral-400 block truncate">{proj.pieceType} ({proj.complexity === "low" ? "Baja" : proj.complexity === "medium" ? "Media" : "Alta"})</span>
                          )}
                        </div>
                      </div>

                      {/* Custom comments preview if any */}
                      {proj.customNotes && (
                        <p className="text-[10px] text-neutral-500 bg-neutral-50 p-1.5 rounded border italic line-clamp-1">
                          Indicaciones: {proj.customNotes}
                        </p>
                      )}

                      {/* Google Drive links if exists */}
                      {proj.driveFileUrl && (
                        <a
                          href={proj.driveFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between text-[9px] bg-blue-50/50 hover:bg-blue-50 border border-blue-150 p-1.5 rounded text-blue-800 font-mono font-bold"
                        >
                          <span className="truncate">📎 PDF EN GOOGLE DRIVE</span>
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        </a>
                      )}

                      {/* Actions strip */}
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        {/* Download and Send alerts strip */}
                        <div className="flex gap-1 w-full">
                          <button
                            onClick={() => handleDownloadPDF(proj)}
                            className="flex-1 border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Descargar presupuesto PDF"
                          >
                            <FileText className="h-3 w-3" />
                            PDF
                          </button>

                          <button
                            disabled={isSyncingToDrive}
                            onClick={() => handleSyncToDrive(proj)}
                            className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Sincronizar a Google Drive"
                          >
                            {isSyncingToDrive ? (
                              <div className="animate-spin w-2.5 h-2.5 border-t-2 border-white rounded-full"></div>
                            ) : (
                              <Upload className="h-3 w-3 text-unke" />
                            )}
                            Drive
                          </button>

                          <button
                            disabled={isSendingEmail}
                            onClick={() => handleSendEmailNotification(proj)}
                            className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Enviar alerta Gmail al cliente"
                          >
                            {isSendingEmail ? (
                              <div className="animate-spin w-2.5 h-2.5 border-t-2 border-neutral-700 rounded-full"></div>
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            Notificar
                          </button>
                        </div>

                        {/* Status updating actions row */}
                        {isAdmin && (
                          <div className="flex flex-wrap gap-1 items-center bg-neutral-50 p-1 rounded-md border border-neutral-200 w-full">
                            <span className="text-[8px] font-extrabold uppercase text-neutral-400 tracking-wider mr-1">Fase:</span>
                            {proj.status === "draft" && (
                              <button
                                onClick={() => handleUpdateStatus(proj, "approved")}
                                className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[8px] capitalize flex items-center gap-0.5 transition cursor-pointer"
                              >
                                <Check className="w-2.5 h-2.5" /> Aprobar
                              </button>
                            )}
                            {(proj.status === "approved" || proj.status === "revision") && (
                              <button
                                onClick={() => handleUpdateStatus(proj, "in_progress")}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[8px] capitalize flex items-center gap-0.5 transition cursor-pointer"
                              >
                                Diseñar
                              </button>
                            )}
                            {proj.status === "in_progress" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdateStatus(proj, "revision")}
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[8px] capitalize transition cursor-pointer"
                                >
                                  Revisar
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(proj, "completed")}
                                  className="bg-green-100 hover:bg-green-200 text-green-800 font-black px-1.5 py-0.5 rounded text-[8px] capitalize transition cursor-pointer"
                                >
                                  Entregar ✓
                                </button>
                              </div>
                            )}
                            {proj.status === "revision" && (
                              <button
                                onClick={() => handleUpdateStatus(proj, "completed")}
                                className="bg-green-100 hover:bg-green-200 text-green-800 font-black px-1.5 py-0.5 rounded text-[8px] capitalize transition cursor-pointer"
                              >
                                Entregar Final
                              </button>
                            )}
                            {proj.status === "completed" && (
                              <span className="text-[9px] text-green-700 font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3 shrink-0" /> Entregado
                              </span>
                            )}

                            {/* Delete button option */}
                            <button
                              onClick={() => handleDeleteProject(proj.id, proj.name)}
                              className="ml-auto p-0.5 text-neutral-400 hover:text-red-400 transition cursor-pointer"
                              title="Borrar Proyecto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
