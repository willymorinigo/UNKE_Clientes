import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, doc, setDoc } from "firebase/firestore";
import { 
  db, auth, initAuth, googleSignIn, logout, forceSetAccessToken,
  handleFirestoreError, OperationType 
} from "./firebase";
import { Project, Client, AuditLog, UserRole } from "./types";
import ProjectsTracker from "./components/ProjectsTracker";
import ClientsManager from "./components/ClientsManager";
import { getUniqueClients } from "./utils/clients";
import PricingTable from "./components/PricingTable";
import ReportsPanel from "./components/ReportsPanel";
import AuditLogs from "./components/AuditLogs";
import UnkeLogo from "./components/UnkeLogo";
import { 
  Briefcase, Users, DollarSign, BarChart3, ClipboardList, LogOut, 
  ShieldCheck, Loader2, Sparkles, UserCheck, AlertOctagon, RefreshCw 
} from "lucide-react";

import willyAvatar from "./assets/willy.jpg";
import ignacioAvatar from "./assets/ignacio.jpg";
import fedeAvatar from "./assets/fede.jpg";

export const STUDIO_MEMBERS: Record<string, { name: string; avatar: string; email: string; role: string }> = {
  "willymorinigo@gmail.com": {
    name: "Willy Morinigo",
    avatar: willyAvatar,
    email: "willymorinigo@gmail.com",
    role: "Socio"
  },
  "ignaciobieski@gmail.com": {
    name: "Ignacio Bieski",
    avatar: ignacioAvatar,
    email: "ignaciobieski@gmail.com",
    role: "Socio"
  },
  "mesfede@gmail.com": {
    name: "Fede Messina",
    avatar: fedeAvatar,
    email: "mesfede@gmail.com",
    role: "Socio"
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<"projects" | "clients" | "pricings" | "reports" | "logs">("projects");

  // App data synced from Firestore
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<UserRole[]>([]);

  // Current user's calculated role info
  const [userRole, setUserRole] = useState<"admin" | "viewer" | "pending">("pending");

  // Bootstrap principal email
  const BOOTSTRAP_ADMIN = "willymorinigo@gmail.com";

  // Trigger operation logs easily in other subcomponents
  const handleLogAction = async (action: string, description: string) => {
    if (!auth.currentUser) return;
    const logId = "log-" + Math.random().toString(36).substr(2, 9);
    const path = `logs/${logId}`;
    const logPayload = {
      id: logId,
      timestamp: new Date().toISOString(),
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email || "anon@studio.unke",
      userName: auth.currentUser.displayName || "Diseñador UNKE",
      action,
      description
    };
    try {
      await setDoc(doc(db, "logs", logId), logPayload);
    } catch (err) {
      console.error("No se pudo escribir en el log de auditoría:", err);
    }
  };

  // 1. Hook up Authentication
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setLoadingAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Load roles strictly from whitelist representing the direct founders
  useEffect(() => {
    if (!user) {
      setUserRole("pending");
      return;
    }

    const loggedEmail = user.email?.toLowerCase().trim();
    const ALLOWED_EMAILS = [
      "willymorinigo@gmail.com",
      "ignaciobieski@gmail.com",
      "mesfede@gmail.com"
    ];

    // Build static list of assigned roles for logs and UI matching
    const staticRoles: UserRole[] = [
      { email: "willymorinigo@gmail.com", role: "admin", name: "Willy Morinigo", assignedAt: "2026-06-12T00:00:00.000Z" },
      { email: "ignaciobieski@gmail.com", role: "admin", name: "Ignacio Bieski", assignedAt: "2026-06-12T00:00:00.000Z" },
      { email: "mesfede@gmail.com", role: "admin", name: "Fede Messina", assignedAt: "2026-06-12T00:00:00.000Z" }
    ];
    setAssignedRoles(staticRoles);

    if (loggedEmail && ALLOWED_EMAILS.includes(loggedEmail)) {
      setUserRole("admin");
    } else {
      setUserRole("pending");
    }
  }, [user]);

  // 3. Real-Time synchronizations for authorized studio crew members
  useEffect(() => {
    if (!user || userRole === "pending") return;

    // A. Sync projects (Real-time Deliveries Tracker)
    const unsubProjects = onSnapshot(
      query(collection(db, "projects"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Project[] = [];
        snap.forEach((d) => {
          list.push(d.data() as Project);
        });
        setProjects(list);
      },
      (err) => console.error("Error sincronizando proyectos de diseño:", err)
    );

    // B. Sync clients profiles (Recurring profiles)
    const unsubClients = onSnapshot(
      collection(db, "clients"),
      (snap) => {
        const list: Client[] = [];
        snap.forEach((d) => {
          list.push(d.data() as Client);
        });
        setClients(list.sort((a,b) => a.name.localeCompare(b.name)));
      },
      (err) => console.error("Error sincronizando directorio de clientes:", err)
    );

    // C. Sync audit trail logs (Operations logs)
    const unsubLogs = onSnapshot(
      query(collection(db, "logs"), orderBy("timestamp", "desc")),
      (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => {
          list.push(d.data() as AuditLog);
        });
        setLogs(list.slice(0, 100)); // last 100 logs
      },
      (err) => console.error("Error sincronizando logs de auditoría:", err)
    );

    return () => {
      unsubProjects();
      unsubClients();
      unsubLogs();
    };
  }, [user, userRole]);

  // Google Sign In trigger
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        
        // Log log-in event trace
        const userMail = res.user.email?.toLowerCase().trim();
        setTimeout(() => {
          handleLogAction("SIGN_IN", `Inició sesión segura desde Google. Correo: ${userMail}`);
        }, 1200);
      }
    } catch (err) {
      console.error("Sign-In failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    const mail = user?.email;
    if (mail) {
      await handleLogAction("SIGN_OUT", `Usuario cerró sesión en UNKE: ${mail}`);
    }
    await logout();
    setUser(null);
    setAccessToken(null);
  };

  const isUserAdmin = userRole === "admin";

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-800 font-sans antialiased flex flex-col">
      {/* 1. Header Navigation Bar (Slim High Density) */}
      <header id="unke-header" className="bg-neutral-950 border-b border-neutral-900 text-white shrink-0">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UnkeLogo className="h-10 w-auto" showSubtitle={false} />
          </div>

          {user && (() => {
            const loggedEmail = user.email?.toLowerCase().trim() || "";
            const member = STUDIO_MEMBERS[loggedEmail];
            const displayName = member ? member.name : user.displayName;
            const avatarUrl = member ? member.avatar : user.photoURL;

            return (
              <div className="flex items-center gap-3">
                {avatarUrl && (
                  <img
                    id="unke-user-avatar"
                    src={avatarUrl}
                    alt={displayName || "Socio"}
                    className="h-8 w-8 rounded-full object-cover border border-neutral-700 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="text-right hidden md:block">
                  <div className="text-[11px] font-bold text-neutral-200">{displayName}</div>
                </div>

                {/* Log out icon button */}
                <button
                  onClick={handleSignOut}
                  className="p-1.5 border border-neutral-800 bg-neutral-900 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer scale-100 active:scale-95 transition-all"
                  title="Cerrar sesión segura"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            );
          })()}
        </div>
      </header>

      {/* 2. Loading State */}
      {loadingAuth ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-neutral-950 text-white">
          <Loader2 className="h-8 w-8 animate-spin text-unke" />
          <span className="text-xs font-semibold tracking-wider uppercase font-mono">Iniciando Servidor UNKE...</span>
        </div>
      ) : !user ? (
        /* 3. Landing & Safe login Page (Pre-Authentication) */
        <main className="flex-1 flex items-center justify-center p-4 bg-neutral-900 relative overflow-hidden font-sans">
          {/* Subtle Ambient Circle Backdrop */}
          <div className="absolute w-[400px] h-[400px] rounded-full bg-neutral-800/45 blur-3xl -top-20 -right-20 pointer-events-none"></div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl relative z-10 text-center">
            <div className="flex flex-col items-center space-y-4">
              <span className="text-[10px] uppercase font-bold text-unke tracking-wider">Acceso de Diseñadores</span>
              <div className="w-full flex justify-center py-2">
                <UnkeLogo style={{ height: "116px" }} className="w-auto" showSubtitle={true} />
              </div>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Sistema interno para organizar entregas, presupuestar con complejidad, sincronizar Drive y notificar a clientes.
              </p>
            </div>

            {/* Material-style GSI Auth button */}
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-neutral-100 font-bold py-3 rounded-lg text-neutral-900 text-xs tracking-wide flex items-center justify-center gap-3 active:scale-[0.98] transition cursor-pointer"
            >
              {isLoggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-900" />
              ) : (
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              )}
              <span>Ingresar con Google Workspace</span>
            </button>

            <p className="text-[10px] text-neutral-500 font-mono">
              Autenticación segura para el estudio UNKE. Privilegios administrados desde el panel central.
            </p>
          </div>
        </main>
      ) : userRole === "pending" ? (
        /* 4. Pending Review Page (Secure Role guard) */
        <main className="flex-1 flex items-center justify-center p-4 bg-neutral-900 text-white font-sans">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-6 text-center space-y-6 shadow-2xl">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-full w-fit mx-auto">
              <AlertOctagon className="h-8 w-8" />
            </div>
 
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Acceso No Autorizado</h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Tu cuenta de Google <b>{user.email}</b> no se encuentra en la lista de accesos exclusivos del estudio UNKE.
              </p>
            </div>
 
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-xl p-4 text-xs text-left space-y-1.5 font-sans">
              <span className="text-[10px] font-black uppercase text-unke block tracking-wide">Accesos Permitidos</span>
              <p className="text-neutral-300 leading-relaxed text-2xs">
                Este sistema es de uso estrictamente confidencial e interno para:
              </p>
              <ul className="text-neutral-400 text-3xs space-y-1 font-mono list-disc pl-3">
                <li>Willy Morinigo (willymorinigo@gmail.com)</li>
                <li>Ignacio Bieski (ignaciobieski@gmail.com)</li>
                <li>Fede Messina (mesfede@gmail.com)</li>
              </ul>
            </div>
 
            <button
              onClick={() => handleSignOut()}
              className="text-xs text-neutral-400 hover:text-white font-semibold transition underline cursor-pointer"
            >
              Cerrar sesión e intentar de nuevo
            </button>
          </div>
        </main>
      ) : (
        /* 5. Main Functional Application Workspace (Authenticated & Authorized) */
        <main className="flex-grow flex flex-col justify-stretch">
          {/* Tabs bar selector (Sleek High Density layout) */}
          <div className="bg-white border-b border-neutral-200">
            <div className="max-w-7xl mx-auto px-3 flex overflow-x-auto text-[11px] font-semibold gap-1 scrollbar-none">
              <button
                onClick={() => setActiveTab("projects")}
                className={`py-2 px-2 whitespace-nowrap flex items-center gap-1 border-b-2 font-bold transition ${
                  activeTab === "projects" ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                Seguimiento
              </button>
              
              <button
                onClick={() => setActiveTab("clients")}
                className={`py-2 px-2 whitespace-nowrap flex items-center gap-1 border-b-2 font-bold transition ${
                  activeTab === "clients" ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                Clientes
              </button>
              
              <button
                onClick={() => setActiveTab("pricings")}
                className={`py-2 px-2 whitespace-nowrap flex items-center gap-1 border-b-2 font-bold transition ${
                  activeTab === "pricings" ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                Precios
              </button>
              
              <button
                onClick={() => setActiveTab("reports")}
                className={`py-2 px-2 whitespace-nowrap flex items-center gap-1 border-b-2 font-bold transition ${
                  activeTab === "reports" ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                Plan Financiero
              </button>
              
              <button
                onClick={() => setActiveTab("logs")}
                className={`py-2 px-2 whitespace-nowrap flex items-center gap-1 border-b-2 font-bold transition ${
                  activeTab === "logs" ? "border-black text-black" : "border-transparent text-neutral-500 hover:text-black"
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                Auditoría
              </button>
            </div>
          </div>

          {/* Active module content viewport (High Density wrapper padding) */}
          <div className="max-w-7xl mx-auto px-3 py-3 w-full flex-grow">
            {activeTab === "projects" && (
              <ProjectsTracker
                userEmail={user.email}
                userName={user.displayName}
                isAdmin={isUserAdmin}
                projects={projects}
                clients={getUniqueClients(clients)}
                onLogAction={handleLogAction}
                onRefreshProjects={() => {}}
              />
            )}

            {activeTab === "clients" && (
              <ClientsManager
                userEmail={user.email}
                userName={user.displayName}
                isAdmin={isUserAdmin}
                projects={projects}
                clients={clients}
                onLogAction={handleLogAction}
              />
            )}

            {activeTab === "pricings" && (
              <PricingTable
                userEmail={user.email}
                isAdmin={isUserAdmin}
                onLogAction={handleLogAction}
              />
            )}

            {activeTab === "reports" && (
              <ReportsPanel
                projects={projects}
              />
            )}

            {activeTab === "logs" && (
              <AuditLogs
                userEmail={user.email}
                userName={user.displayName}
                isAdmin={isUserAdmin}
                logs={logs}
                onLogAction={handleLogAction}
              />
            )}
          </div>
        </main>
      )}

      {/* 6. Footer disclaimer */}
      <footer id="unke-footer" className="bg-white border-t py-2.5 text-center text-[9px] text-neutral-400 shrink-0 select-none">
        <div>UNKE Estudio Creativo © {new Date().getFullYear()} • La Plata, Buenos Aires, Argentina • Todos los derechos reservados</div>
      </footer>
    </div>
  );
}
