export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  createdAt: string;
  createdBy: string;
}

export interface PricingItem {
  id: string;
  pieceName: string;
  basePrice: number;
  factorLow: number;
  factorMedium: number;
  factorHigh: number;
}

export type ProjectStatus = "draft" | "approved" | "in_progress" | "revision" | "completed";

export interface BudgetPieceItem {
  id: string;
  pieceId: string;
  pieceName: string;
  complexity: "low" | "medium" | "high";
  quantity: number;
  customAdjustment: number;
  price: number;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  pieceType: string;         // pieceName or pricing ID
  complexity: "low" | "medium" | "high";
  quantity: number;
  customAdjustment: number;  // custom discounts or charges
  price: number;             // automatically calculated price
  deliveryDate: string;      // YYYY-MM-DD
  status: ProjectStatus;
  driveFileId?: string;
  driveFileUrl?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  customNotes?: string;
  pieces?: BudgetPieceItem[];
}

export interface UserRole {
  email: string;
  role: "admin" | "viewer";
  name: string;
  assignedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  description: string;
}
