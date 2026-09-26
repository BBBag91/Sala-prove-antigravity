import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Music2,
  Users,
  CreditCard,
  DoorOpen,
  Receipt,
  RotateCcw,
  Layers,
  ChevronDown,
  Check,
  Building2,
  LogOut,
  Shield,
  User,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { CalendarDashboardView } from './components/CalendarDashboardView';
import { BookingsView } from './components/BookingsView';
import { StaffView } from './components/StaffView';
import { ClientsView } from './components/ClientsView';
import { RoomsView } from './components/RoomsView';
import { FinanceView } from './components/FinanceView';
import { AnagraficaView } from './components/AnagraficaView';

type TabType = 'calendar' | 'bookings' | 'staff' | 'clients' | 'rooms' | 'finance' | 'anagrafica';

interface NavSectionItem {
  id: TabType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  badge?: number;
}

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isUser, switchRole, logout } = useAuth();
  const { isCloudConnected } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { resetToDemoData, studioInfo, bookings, staff, clients, expenses } = useApp();

  // Route Guard: Utente standard può accedere solo al Calendario
  useEffect(() => {
    if (isUser && activeTab !== 'calendar') {
      setActiveTab('calendar');
    }
  }, [isUser, activeTab]);

  // Close dropdown and mobile menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    if (isMenuOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isMobileMenuOpen]);

  // Close mobile menu on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Se non autenticato, mostra la schermata di login
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  const handleResetDemo = () => {
    if (
      window.confirm(
        'Vuoi ripristinare i dati di esempio (sale prove, operatori con turni primari, clienti tesserati e calendario)?'
      )
    ) {
      resetToDemoData();
    }
  };

  const dropdownSections: NavSectionItem[] = [
    {
      id: 'anagrafica',
      label: 'Anagrafica',
      shortLabel: 'Anagrafica',
      description: 'Nome sala prove, intestazione ufficiale, sede e recapiti della struttura',
      icon: <Building2 className="w-4 h-4 text-yellow-400" />,
    },
    {
      id: 'bookings',
      label: 'Prenotazioni',
      shortLabel: 'Prenotazioni',
      description: 'Planning sale prove, calendario slot e stato conferme',
      icon: <Music2 className="w-4 h-4 text-yellow-400" />,
      badge: bookings.length,
    },
    {
      id: 'staff',
      label: 'Operatori & Turni',
      shortLabel: 'Operatori',
      description: 'Staff, fasce orarie 24h, turni primari e assegnazione intelligente',
      icon: <Users className="w-4 h-4 text-yellow-400" />,
      badge: staff.length,
    },
    {
      id: 'clients',
      label: 'Clienti & Tesseramento',
      shortLabel: 'Clienti',
      description: 'Anagrafica band, stato tesseramento annuale e contatti',
      icon: <CreditCard className="w-4 h-4 text-yellow-400" />,
      badge: clients.length,
    },
    {
      id: 'rooms',
      label: 'Sale Prove',
      shortLabel: 'Sale',
      description: 'Tariffe orarie, dotazione amplificatori, mixer e capienza',
      icon: <DoorOpen className="w-4 h-4 text-yellow-400" />,
    },
    {
      id: 'finance',
      label: 'Spese & Conto Mensile',
      shortLabel: 'Spese & Conto',
      description: 'Bilancio entrate/uscite, canoni, bollette e saldo del mese',
      icon: <Receipt className="w-4 h-4 text-yellow-400" />,
      badge: expenses.length,
    },
  ];

  const activeDropdownSection = dropdownSections.find((item) => item.id === activeTab);

  return (
    <div className="min-h-screen bg-black text-yellow-50 flex flex-col antialiased selection:bg-yellow-400 selection:text-black">      {/* Top Header */}
      <header className="bg-neutral-950/95 border-b border-yellow-500/30 sticky top-0 z-40 shadow-lg shadow-black/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 justify-between gap-2 sm:gap-3">

            {/* ── Logo / Brand ── */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-bold shadow-md shadow-yellow-500/30 shrink-0">
                <Music2 className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white leading-tight flex items-center gap-1.5 truncate">
                  <span>SALA PROVE</span>
                  <span className="text-yellow-400 font-bold truncate">• {studioInfo.nome}</span>
                </h1>
                <p className="text-[10px] text-yellow-400/60 leading-tight truncate hidden sm:block">
                  {studioInfo.sottotitolo || 'Associazione Culturale Musicale • Centro Prove & Registrazione'}
                </p>
              </div>
            </div>

            {/* ── Desktop Navigation (hidden on mobile, visible on md and up) ── */}
            <nav className="hidden md:flex items-center gap-1.5 min-w-0">
              <div className="w-px h-6 bg-yellow-500/20 mr-1 shrink-0" />

              {/* Calendario tab */}
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeTab === 'calendar'
                    ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                    : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Calendario</span>
              </button>

              {/* ── ADMIN ONLY: Conti del Mese & Bollette Tab ── */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setActiveTab('finance');
                    setIsMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'finance'
                      ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                      : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                  }`}
                  title="Gestione conti del mese, uscite e bollette"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Conti &amp; Bollette</span>
                  {expenses.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      activeTab === 'finance' ? 'bg-black text-yellow-400' : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                    }`}>
                      {expenses.length}
                    </span>
                  )}
                </button>
              )}

              {/* ── ADMIN ONLY: Dropdown Sezioni Gestionali ── */}
              {isAdmin && (
                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    aria-expanded={isMenuOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab !== 'calendar' && activeTab !== 'finance'
                        ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                        : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-yellow-500/30'
                    }`}
                  >
                    {activeDropdownSection && activeTab !== 'finance' ? (
                      <>
                        {activeDropdownSection.icon}
                        <span>{activeDropdownSection.shortLabel}</span>
                        {activeDropdownSection.badge !== undefined && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            activeTab !== 'calendar'
                              ? 'bg-black text-yellow-400'
                              : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                          }`}>
                            {activeDropdownSection.badge}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        <span>Altre Sezioni</span>
                      </>
                    )}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ml-0.5 ${
                        isMenuOpen ? 'rotate-180 text-yellow-400' : 'text-yellow-500/70'
                      }`}
                    />
                  </button>

                  {/* Dropdown panel */}
                  {isMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-96 bg-neutral-950 rounded-xl shadow-2xl border border-yellow-500/40 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3.5 py-2 border-b border-yellow-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5 text-yellow-400" />
                          <span>Sezioni Amministrative</span>
                        </div>
                        <span className="text-[10px] text-yellow-500/60">{dropdownSections.length} sezioni</span>
                      </div>

                      <div className="p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
                        {dropdownSections.map((item) => {
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                setIsMenuOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-3 transition-colors ${
                                isItemActive
                                  ? 'bg-yellow-400/15 border border-yellow-500/40 text-yellow-300'
                                  : 'hover:bg-neutral-900 border border-transparent text-neutral-300 hover:text-yellow-300'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                  isItemActive ? 'bg-yellow-400 text-black' : 'bg-neutral-900 text-yellow-400 border border-yellow-500/20'
                                }`}
                              >
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-xs font-semibold truncate ${
                                    isItemActive ? 'text-yellow-400 font-bold' : 'text-neutral-200'
                                  }`}>
                                    {item.label}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {item.badge !== undefined && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        isItemActive ? 'bg-yellow-400 text-black' : 'bg-neutral-900 text-yellow-400 border border-yellow-500/30'
                                      }`}>
                                        {item.badge}
                                      </span>
                                    )}
                                    {isItemActive && <Check className="w-3 h-3 text-yellow-400 stroke-[3]" />}
                                  </div>
                                </div>
                                <p className="text-[10px] text-yellow-500/60 line-clamp-1 mt-0.5">{item.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* ── Desktop User Profile & Actions (hidden on mobile, visible on md and up) ── */}
            <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Role badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors select-none ${
                  isAdmin
                    ? 'bg-yellow-400/15 border-yellow-500/40 text-yellow-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                }`}
                title={`Profilo: ${user.nome} (${user.email})`}
              >
                {isAdmin ? (
                  <>
                    <Shield className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>Utente</span>
                  </>
                )}
              </div>

              {/* 1-Click Role Switcher */}
              <button
                onClick={switchRole}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-yellow-300 text-xs font-semibold border border-yellow-500/20 transition-all cursor-pointer"
                title={`Passa a profilo ${isAdmin ? 'Utente Standard' : 'Amministratore'}`}
              >
                <RefreshCw className="w-3 h-3 text-yellow-400" />
                <span className="hidden xl:inline">{isAdmin ? 'Simula Utente' : 'Simula Admin'}</span>
              </button>

              {/* Demo Data Reset (Admin only) */}
              {isAdmin && (
                <button
                  onClick={handleResetDemo}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 hover:bg-yellow-400 text-yellow-400 hover:text-black text-xs font-bold border border-yellow-500/30 hover:border-yellow-400 transition-all shadow-sm group"
                  title="Ripristina dati realistici dimostrativi"
                >
                  <RotateCcw className="w-3 h-3 text-yellow-400 group-hover:text-black transition-colors" />
                  <span className="hidden xl:inline">Demo</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 text-xs font-bold border border-rose-500/30 transition-all shadow-sm cursor-pointer"
                title="Disconnetti dalla sessione"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Esci</span>
              </button>
            </div>

            {/* ── Mobile Right Actions (Compact, Clean & Responsive) ── */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">

              {/* Mobile Role badge */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border select-none ${
                  isAdmin
                    ? 'bg-yellow-400/15 border-yellow-500/40 text-yellow-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                }`}
              >
                {isAdmin ? (
                  <>
                    <Shield className="w-3 h-3 text-yellow-400" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-neutral-400" />
                    <span>Utente</span>
                  </>
                )}
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-1.5 rounded-lg border transition-all ${
                  isMobileMenuOpen
                    ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-500/30'
                    : 'bg-neutral-900 text-yellow-400 border-yellow-500/30 hover:bg-neutral-800'
                }`}
                aria-label="Apri menu opzioni"
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Menu className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            </div>

          </div>

          {/* ── Mobile Horizontal Tab Strip (Fast 1-Tap Switching) ── */}
          <div className="md:hidden py-1.5 border-t border-yellow-500/15 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab('calendar');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                  : 'bg-neutral-900/80 text-yellow-100/70 border border-yellow-500/20'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Calendario</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('finance');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                    activeTab === 'finance'
                      ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                      : 'bg-neutral-900/80 text-yellow-100/70 border border-yellow-500/20'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Conti &amp; Bollette</span>
                  {expenses.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      activeTab === 'finance' ? 'bg-black text-yellow-400' : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                    }`}>
                      {expenses.length}
                    </span>
                  )}
                </button>

                {dropdownSections.filter((s) => s.id !== 'finance').map((section) => {
                  const isActive = activeTab === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveTab(section.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                        isActive
                          ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                          : 'bg-neutral-900/80 text-yellow-100/70 border border-yellow-500/20'
                      }`}
                    >
                      {section.icon}
                      <span>{section.shortLabel}</span>
                      {section.badge !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-black text-yellow-400' : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                        }`}>
                          {section.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Menu Drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-neutral-950 border-l border-yellow-500/30 p-4 shadow-2xl flex flex-col z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-yellow-500/20">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-bold">
                  <Music2 className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white leading-tight">SALA PROVE</h3>
                  <p className="text-[10px] text-yellow-400/70 truncate max-w-[150px]">{studioInfo.nome}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-yellow-400 hover:bg-neutral-900 border border-yellow-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="my-3 p-3 rounded-xl bg-neutral-900/90 border border-yellow-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold text-sm">
                    {user.avatar || (isAdmin ? '👑' : '👤')}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{user.nome}</h4>
                    <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[130px]">{user.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isAdmin ? 'bg-yellow-400/15 border-yellow-500/40 text-yellow-300' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}>
                  {isAdmin ? 'ADMIN' : 'UTENTE'}
                </span>
              </div>

              {/* Quick actions inside drawer */}
              <div className="pt-2 border-t border-neutral-800">
                <button
                  onClick={() => {
                    switchRole();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-yellow-300 text-xs font-semibold border border-yellow-500/20 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{isAdmin ? 'Simula Utente Standard' : 'Simula Amministratore'}</span>
                </button>
              </div>
            </div>

            {/* Navigation List in Drawer */}
            <div className="flex-1 space-y-1 py-1">
              <p className="text-[10px] uppercase font-bold text-yellow-500/60 px-2 tracking-wider">Navigazione</p>

              {/* Calendario */}
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'calendar'
                    ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                    : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Calendario &amp; Prenotazioni</span>
                </div>
                {activeTab === 'calendar' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('finance');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'finance'
                        ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                        : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4" />
                      <span>Spese &amp; Conto Mensile</span>
                    </div>
                    {expenses.length > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        activeTab === 'finance' ? 'bg-black text-yellow-400' : 'bg-neutral-800 text-yellow-300'
                      }`}>
                        {expenses.length}
                      </span>
                    )}
                  </button>

                  {dropdownSections.filter((s) => s.id !== 'finance').map((item) => {
                    const isItemActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isItemActive
                            ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                            : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.badge !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              isItemActive ? 'bg-black text-yellow-400' : 'bg-neutral-800 text-yellow-300'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          {isItemActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Bottom Actions in Drawer */}
            <div className="pt-3 border-t border-yellow-500/20 space-y-2 mt-auto">
              {isAdmin && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleResetDemo();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 text-xs font-semibold border border-yellow-500/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ripristina Dati Demo</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnetti (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 flex-1 w-full">
        {activeTab === 'calendar' && <CalendarDashboardView />}
        {isAdmin && (
          <>
            {activeTab === 'anagrafica' && (
              <AnagraficaView onNavigateTab={(tab) => setActiveTab(tab)} />
            )}
            {activeTab === 'bookings' && <BookingsView />}
            {activeTab === 'staff' && <StaffView />}
            {activeTab === 'clients' && <ClientsView />}
            {activeTab === 'rooms' && (
              <RoomsView onNavigateToAnagrafica={() => setActiveTab('anagrafica')} />
            )}
            {activeTab === 'finance' && <FinanceView />}
          </>
        )}
        {!isAdmin && activeTab !== 'calendar' && (
          <div className="bg-neutral-950 border border-rose-500/30 rounded-2xl p-8 text-center space-y-3 my-8">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Accesso Riservato</h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Questa sezione è riservata all'Amministratore. Il tuo account utente ha accesso esclusivamente al Calendario e alla gestione appuntamenti.
            </p>
            <button
              onClick={() => setActiveTab('calendar')}
              className="px-4 py-2 bg-yellow-400 text-black font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-yellow-300 transition-all"
            >
              Torna al Calendario
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-yellow-500/25 py-4 text-center text-xs text-yellow-100/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong className="text-yellow-400 font-bold">Gestione Sala Prove Musicale</strong> • <span className="text-neutral-300">Controllo Accessi RBAC attivo &bull; Profilo: <strong className="text-yellow-300 font-semibold">{user.nome} ({user.ruolo.toUpperCase()})</strong></span>
          </p>
          <p className="text-[11px] text-yellow-500/70 flex items-center gap-1.5 justify-center sm:justify-end">
            <span className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>Database Cloud Connesso</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
