import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { AuditLog, UserRole } from "../types";
import { ShieldAlert, Trash2, UserPlus, ClipboardList, Shield, User, Clock, AlertTriangle } from "lucide-react";
import { STUDIO_MEMBERS } from "../App";

interface AuditLogsProps {
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  isAdmin: boolean;
  logs: AuditLog[];
  onLogAction: (actionName: string, description: string) => void;
}

export default function AuditLogs({ userEmail, userName, isAdmin, logs, onLogAction }: AuditLogsProps) {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // New role parameters
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("admin");
  const [newMemberName, setNewMemberName] = useState("");

  const fetchRoles = async () => {
    setLoadingRoles(true);
    const path = "roles";
    try {
      const snap = await getDocs(collection(db, path));
      const list: UserRole[] = [];
      snap.forEach((d) => {
        list.push({ email: d.id, ...d.data() } as UserRole);
      });
      setRoles(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleAddRoleShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newEmail.trim() || !newEmail.includes("@")) return;

    const emailKey = newEmail.trim().toLowerCase();
    const path = `roles/${emailKey}`;
    const entry: UserRole = {
      email: emailKey,
      role: newRole,
      name: newMemberName.trim() || emailKey.split("@")[0],
      assignedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "roles", emailKey), entry);
      setRoles([...roles.filter(r => r.email !== emailKey), entry]);
      
      // Reset
      setNewEmail("");
      setNewMemberName("");
      setNewRole("admin");

      onLogAction("ASSIGN_ROLE", `Asignó el rol '${entry.role.toUpperCase()}' al miembro '${entry.name}' (${entry.email}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleRevokeRole = async (emailToDelete: string, memberName: string) => {
    if (!isAdmin) return;
    if (emailToDelete === "willymorinigo@gmail.com") {
      alert("No puedes revocar los accesos de Willy Morinigo, es el administrador principal.");
      return;
    }

    const confFlag = window.confirm(`¿Estás seguro de revocar los accesos de ${memberName || emailToDelete}?`);
    if (!confFlag) return;

    const path = `roles/${emailToDelete}`;
    try {
      await deleteDoc(doc(db, "roles", emailToDelete));
      setRoles(roles.filter(r => r.email !== emailToDelete));

      onLogAction("REVOKE_ROLE", `Eliminó permisos y acceso al sistema del miembro: '${memberName}' (${emailToDelete}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <div id="administrative-panel" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Central de Permisos */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-neutral-900 border-b flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-neutral-200">Panel Central de Accesos</span>
              <Shield className="h-4 w-4 text-unke" />
            </div>

            <div className="p-4 border-b bg-neutral-50/50 text-neutral-600 text-xs flex items-start gap-2">
              <Shield className="h-4 w-4 shrink-0 mt-0.5 text-unke" />
              <span>Accesos exclusivos y restringidos de forma inmutable mediante el servidor seguro.</span>
            </div>

            <div className="p-4 space-y-3">
              <span className="text-3xs font-extrabold uppercase tracking-wide text-neutral-400 block">Miembros Autorizados</span>
              
              <div className="divide-y text-xs divide-neutral-100">
                {Object.values(STUDIO_MEMBERS).map((m) => (
                  <div key={m.email} className="py-3 flex items-center gap-3">
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="h-9 w-9 rounded-full object-cover border border-neutral-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-neutral-800 text-xs">
                        {m.name}
                      </div>
                      <div className="text-3xs text-neutral-500 truncate font-mono mt-0.5">{m.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Historial Detallado de Cambios / LOGS (Audit logs) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4.5 border-b bg-neutral-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-neutral-600" />
                <h3 className="font-bold text-xs text-neutral-800 uppercase tracking-wide">Historial Detallado de Operaciones y Auditoría</h3>
              </div>
              <span className="text-3xs bg-neutral-100 border text-neutral-500 font-bold px-2 py-0.5 rounded-full">
                {logs.length} Logueos Registrados
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                <ClipboardList className="h-8 w-8 text-neutral-300" />
                <span>No se registraron cambios recientemente. Toda modificación de presupuestos, clientes o estados se registrará aquí para control del estudio.</span>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto text-xs">
                {logs.map((log) => {
                  const date = new Date(log.timestamp);
                  return (
                    <div key={log.id} className="p-4 hover:bg-neutral-50/40 transition flex items-start gap-3">
                      <div className="bg-neutral-900 border text-white p-1.5 rounded-md mt-0.5">
                        <User className="h-3 w-3" />
                      </div>
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-start md:items-center justify-between gap-2 md:flex-row flex-col">
                          <span className="font-bold text-neutral-800 text-xs block">
                            {log.userName} ({log.userEmail})
                          </span>
                          <span className="text-3xs text-neutral-400 font-medium flex items-center gap-1 flex-row">
                            <Clock className="h-3 w-3 shrink-0" />
                            {date.toLocaleDateString("es-ES")} {date.toLocaleTimeString("es-ES")}
                          </span>
                        </div>

                        <p className="text-neutral-600">{log.description}</p>
                        
                        <div className="flex gap-2">
                          <span className="text-[10px] uppercase font-bold text-neutral-500 bg-neutral-100 border rounded-md px-2 py-0.3">
                            Servicio: {log.action}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
