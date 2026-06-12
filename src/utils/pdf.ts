import { jsPDF } from "jspdf";
import { Project, Client } from "../types";
import { formatARS, formatARSWithSign } from "./format";

export function generateBudgetPDF(project: Project, client: Client | undefined): Blob {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Header Background
  doc.setFillColor(28, 28, 30); // Refined Dark Charcoal
  doc.rect(0, 0, 210, 48, "F");

  // UNKE Studio Logo Styling
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(28);
  doc.text("UNKE", 20, 22);

  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  doc.text("ESTUDIO DE DISEÑO GRÁFICO", 20, 28);

  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 180);
  doc.text("Branding • Packaging • Desarrollo Web & Mobile • Editorial", 20, 34);

  // Estudio Coordinates (La Plata, Buenos Aires, Argentina)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("Helvetica", "bold");
  doc.text("UNKE Estudio", 145, 18);
  doc.setFontSize(8);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text("La Plata, Buenos Aires, Argentina", 145, 24);
  doc.text("hola@unke.design", 145, 29);
  doc.text("www.unke.design", 145, 34);

  // Section: Budget Document Details
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("Helvetica", "bold");
  doc.text("PRESUPUESTO FORMAL", 20, 62);

  // Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(20, 65, 190, 65);

  // Project Information Metrics
  doc.setFontSize(9.5);
  doc.setFont("Helvetica", "bold");
  doc.text("Detalle / Proyecto:", 20, 75);
  doc.setFont("Helvetica", "normal");
  doc.text(project.name, 55, 75);

  doc.setFont("Helvetica", "bold");
  doc.text("Fecha de Emisión:", 20, 81);
  doc.setFont("Helvetica", "normal");
  doc.text(new Date(project.createdAt).toLocaleDateString("es-ES"), 55, 81);

  doc.setFont("Helvetica", "bold");
  doc.text("Ref. de Control:", 20, 87);
  doc.setFont("Helvetica", "normal");
  doc.text(`UNKE-PR-${project.id.slice(0, 6).toUpperCase()}`, 55, 87);

  doc.setFont("Helvetica", "bold");
  doc.text("Fecha de Entrega:", 20, 93);
  doc.setFont("Helvetica", "normal");
  doc.text(project.deliveryDate ? new Date(project.deliveryDate + "T00:00:00").toLocaleDateString("es-ES") : "A convenir", 55, 93);

  // Client Details Card Box
  doc.setFillColor(245, 245, 243);
  doc.rect(20, 102, 170, 34, "F");

  doc.setFontSize(10);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("DESTINATARIO / CLIENTE RECURRENTE", 25, 109);

  doc.setFontSize(9);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(`Nombre / Razón Social: ${client?.name || project.clientName}`, 25, 115);
  doc.text(`Correo Electrónico: ${client?.email || project.clientEmail}`, 25, 120);
  doc.text(`Empresa u Organización: ${client?.company || "Estudio / Particular"}`, 25, 125);
  doc.text(`Teléfono Móvil: ${client?.phone || "No registrado"}`, 25, 130);

  // Services Breakdown Header
  doc.setFontSize(11);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("SERVICIOS Y SELECCIÓN DE PIEZAS", 20, 148);

  // Table header background
  doc.setFillColor(235, 235, 235);
  doc.rect(20, 152, 170, 8, "F");

  doc.setFontSize(8.5);
  doc.setFont("Helvetica", "bold");
  doc.text("Tipo de Pieza de Diseño", 23, 157);
  doc.text("Complejidad", 100, 157);
  doc.text("Cant.", 135, 157);
  doc.text("Subtotal", 165, 157);

  // Table content
  doc.setFontSize(9);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  let currentY = 167;

  if (project.pieces && project.pieces.length > 0) {
    project.pieces.forEach((item) => {
      doc.text(item.pieceName, 23, currentY);
      let compT = "Baja";
      if (item.complexity === "medium") compT = "Media";
      if (item.complexity === "high") compT = "Alta";
      doc.text(compT, 100, currentY);
      doc.text(String(item.quantity), 135, currentY);
      doc.text(formatARS(item.price), 165, currentY);
      currentY += 7;
    });
  } else {
    doc.text(project.pieceType, 23, currentY);
    let compText = "Baja";
    if (project.complexity === "medium") compText = "Media (Multiplicador x1.4)";
    if (project.complexity === "high") compText = "Alta (Multiplicador x2.0)";
    doc.text(compText, 100, currentY);
    doc.text(String(project.quantity), 135, currentY);
    doc.text(formatARS(project.price - project.customAdjustment), 165, currentY);
    currentY += 7;

    // Adjustments detail
    if (project.customAdjustment !== 0) {
      doc.setFont("Helvetica", "italic");
      doc.text("Descuentos o cargos particulares personalizados", 23, currentY);
      doc.setFont("Helvetica", "normal");
      doc.text("-", 100, currentY);
      doc.text("1", 135, currentY);
      doc.text(formatARSWithSign(project.customAdjustment), 165, currentY);
      currentY += 7;
    }
  }

  // Draw end-of-table separator line
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(20, currentY, 190, currentY);

  currentY += 11;

  // Calculated Budget totals
  doc.setFontSize(11);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(15, 15, 20);
  doc.text("PRESUPUESTO TOTAL PLANIFICADO:", 95, currentY);
  doc.setFontSize(13);
  doc.text(formatARS(project.price), 165, currentY, { align: "right" });

  currentY += 9;

  // Standard terms box
  doc.setFillColor(248, 248, 250);
  doc.rect(20, currentY, 170, 32, "F");

  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.setFont("Helvetica", "bold");
  doc.text("Términos & Condiciones del Estudio UNKE:", 24, currentY + 6);
  doc.setFont("Helvetica", "normal");
  doc.text("• Validez de los Costos: 15 días corridos desde la emisión.", 24, currentY + 11);
  doc.text("• Condición de Pago: 50% para aprobación e inicio y 50% contra entrega final.", 24, currentY + 16);
  doc.text("• El trabajo de diseño incluye un total de hasta 3 rondas guiadas de revisiones.", 24, currentY + 21);
  doc.text("• Al momento de la aprobación se dispara el seguimiento de entregas coordinadas.", 24, currentY + 26);

  currentY += 41;

  // Custom comments if added
  if (project.customNotes) {
    doc.setTextColor(40, 40, 40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Indicaciones del Diseñador:", 20, currentY);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    const notesLines = doc.splitTextToSize(project.customNotes, 170);
    doc.text(notesLines, 20, currentY + 5);
  }

  // Design crew and gratitude block
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont("Helvetica", "bold");
  doc.text("Equipo UNKE: Willy, Nacho y Fede", 105, 280, { align: "center" });
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("La Plata, Buenos Aires, Argentina • Documento de estudio generado en tiempo real", 105, 284, { align: "center" });

  return doc.output("blob");
}
