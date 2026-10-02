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
  UserPlus,
  RefreshCw,
  Menu,
  X,
  CalendarClock,
  MessageSquare,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { LoginView } from './components/LoginView';
import { CalendarDashboardView } from './components/CalendarDashboardView';
import { ShiftsView } from './components/ShiftsView';
import { BookingsView } from './components/BookingsView';
import { StaffView } from './components/StaffView';
import { ClientsView } from './components/ClientsView';
import { RoomsView } from './components/RoomsView';
import { FinanceView } from './components/FinanceView';
import { AnagraficaView } from './components/AnagraficaView';
import { UserManagementModal } from './components/UserManagementModal';
import { MorningBriefingModal } from './components/MorningBriefingModal';
import { WhatsAppSettingsModal } from './components/WhatsAppSettingsModal';
import { MorningNotificationWatcher } from './components/MorningNotificationWatcher';
import { TeacherProfileReportModal } from './components/TeacherProfileReportModal';

type TabType = 'calendar' | 'turni' | 'bookings' | 'staff' | 'clients' | 'rooms' | 'finance' | 'anagrafica';

interface NavSectionItem {
  id: TabType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  badge?: number;
}

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isUser, logout } = useAuth();
  const { isCloudConnected } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [isWhatsAppSettingsOpen, setIsWhatsAppSettingsOpen] = useState(false);
  const [isTeacherReportModalOpen, setIsTeacherReportModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { resetToDemoData, studioInfo, bookings, staff, clients, expenses } = useApp();

  // Route Guard: Utente standard può accedere al Calendario e allo Schema Turni
  useEffect(() => {
    if (isUser && activeTab !== 'calendar' && activeTab !== 'turni') {
      setActiveTab('calendar');
    }
  }, [isUser, activeTab]);

  // Close dropdown and mobile menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    if (isMenuOpen || isUserMenuOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isUserMenuOpen, isMobileMenuOpen]);

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
      id: 'turni',
      label: 'Turni Presidio Sala',
      shortLabel: 'Turni Sala',
      description: 'Pianificazione Lun-Ven (17-20 / 20-23) con adattamento dinamico automatico',
      icon: <CalendarClock className="w-4 h-4 text-yellow-400" />,
      badge: 10,
    },
    {
      id: 'staff',
      label: 'Anagrafica Personale',
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
    <div className="min-h-screen bg-black text-yellow-50 flex flex-col antialiased selection:bg-yellow-400 selection:text-black print:min-h-0 print:bg-white print:text-black">
      {/* Top Header */}
      <header className="bg-neutral-950/95 border-b border-yellow-500/30 sticky top-0 z-40 shadow-lg shadow-black/80 backdrop-blur print:hidden">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex items-center h-14 justify-between gap-1.5 sm:gap-2 lg:gap-3">

            {/* ── Left: Brand & Desktop Navigation ── */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
              {/* Logo / Brand */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-bold shadow-md shadow-yellow-500/30 shrink-0">
                  <Music2 className="w-4 h-4 text-black stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs sm:text-sm font-bold tracking-tight leading-tight flex items-center gap-1">
                    <span className="hidden sm:inline shrink-0 bg-blue-600 text-white dark:bg-yellow-400 dark:text-black px-1.5 py-0.5 rounded-md">SALA PROVE</span>
                    <span className="text-blue-600 dark:text-yellow-400 font-bold truncate max-w-[90px] sm:max-w-[130px] lg:max-w-[160px] 2xl:max-w-[220px]">
                      <span className="sm:hidden">• </span>{studioInfo.nome}
                    </span>
                  </h1>
                  <p className="text-[10px] text-yellow-400/60 leading-tight truncate hidden 2xl:block">
                    {studioInfo.sottotitolo || 'Associazione Culturale Musicale • Centro Prove & Registrazione'}
                  </p>
                </div>
              </div>

              {/* Vertical separator */}
              <div className="hidden md:block w-px h-5 bg-yellow-500/20 shrink-0" />

              {/* Desktop Navigation Tabs */}
              <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 shrink-0">
                {/* Calendario tab */}
                <button
                  onClick={() => {
                    setActiveTab('calendar');
                    setIsMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'calendar'
                      ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                      : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                  <span>Calendario</span>
                </button>

                {/* Schema Turni Settimana Tab (In primo piano per accesso immediato) */}
                <button
                  onClick={() => {
                    setActiveTab('turni');
                    setIsMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'turni'
                      ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                      : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                  }`}
                  title="Schema riepilogativo settimanale dei turni di presidio"
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline">Schema Turni</span>
                  <span className="xl:hidden">Turni</span>
                </button>

                {/* ADMIN ONLY: Conti del Mese & Bollette Tab */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('finance');
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      activeTab === 'finance'
                        ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                        : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                    }`}
                    title="Gestione conti del mese, uscite e bollette"
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden xl:inline">Conti &amp; Bollette</span>
                    <span className="xl:hidden">Conti</span>
                    {expenses.length > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        activeTab === 'finance' ? 'bg-black text-yellow-400' : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                      }`}>
                        {expenses.length}
                      </span>
                    )}
                  </button>
                )}

                {/* ADMIN ONLY: Dropdown Sezioni Gestionali */}
                {isAdmin && (
                  <div className="relative shrink-0" ref={menuRef}>
                    <button
                      onClick={() => setIsMenuOpen((prev) => !prev)}
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                      className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab !== 'calendar' && activeTab !== 'finance' && activeTab !== 'turni'
                          ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                          : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-yellow-500/30'
                      }`}
                    >
                      {activeDropdownSection && activeTab !== 'finance' && activeTab !== 'turni' && activeTab !== 'calendar' ? (
                        <>
                          {activeDropdownSection.icon}
                          <span>{activeDropdownSection.shortLabel}</span>
                          {activeDropdownSection.badge !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              activeTab !== 'calendar' && activeTab !== 'turni'
                                ? 'bg-black text-yellow-400'
                                : 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                            }`}>
                              {activeDropdownSection.badge}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden xl:inline">Altre Sezioni</span>
                          <span className="xl:hidden">Altre</span>
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
                      <div className="absolute left-0 top-full mt-1.5 w-80 bg-neutral-950 rounded-xl shadow-2xl border border-yellow-500/40 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
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
            </div>

            {/* ── Right: User Profile & Actions (Uncluttered, Elegant & Never Overlapping) ── */}
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">

              {/* Theme Toggle (Versione Scura / Versione Chiara) */}
              <ThemeToggle responsiveLabel={true} />

              {/* Profile Dropdown Menu */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`admin-header-btn-blue flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm ${
                    isAdmin
                      ? '!bg-blue-600 hover:!bg-blue-700 !text-white border-blue-500 shadow-blue-500/25'
                      : isUserMenuOpen
                      ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
                      : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-200'
                  }`}
                  style={isAdmin ? { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' } : undefined}
                  title={`Profilo: ${user.nome} (${user.email})`}
                >
                  <div className="relative w-5 h-5 shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                      isAdmin ? 'bg-white/20 text-white' : 'bg-yellow-400/20'
                    }`}>
                      {isAdmin ? '👑' : '👤'}
                    </div>
                    {/* Indicatore riepilogo mattutino - solo admin */}
                    {isAdmin && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-neutral-900 animate-pulse" />}
                  </div>
                  <span
                    className="font-bold text-white truncate max-w-[80px] lg:max-w-[110px] xl:max-w-[140px]"
                    style={{ color: '#ffffff' }}
                  >
                    {user.nome || (isAdmin ? 'Admin' : 'Utente')}
                  </span>
                  <span className={`admin-badge-pill hidden xl:inline-block text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                    isAdmin ? 'bg-white text-blue-700 shadow-2xs' : 'bg-neutral-800 text-neutral-300'
                  }`}
                  style={isAdmin ? { backgroundColor: '#ffffff', color: '#1d4ed8' } : undefined}
                  >
                    {isAdmin ? 'ADMIN' : 'Utente'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${isAdmin ? 'text-white' : 'text-neutral-400'} ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown Panel */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 bg-neutral-950 rounded-xl shadow-2xl border border-yellow-500/40 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150 space-y-1">
                    {/* User header info */}
                    <div className="px-3 py-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-bold text-sm">
                          {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{user.nome}</p>
                          <p className="text-[11px] text-neutral-400 font-mono truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px]">
                        <span className="text-neutral-400">Ruolo Account:</span>
                        <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                          isAdmin ? 'bg-yellow-400/20 text-yellow-300' : 'bg-neutral-800 text-neutral-300'
                        }`}>
                          {isAdmin ? 'Amministratore' : 'Utente Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Admin actions */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setIsUserManagementOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-neutral-200 hover:text-yellow-300 hover:bg-neutral-900 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span>Gestione Account &amp; Nuovi Utenti</span>
                      </button>
                    )}

                    {/* Tesseramento (accessibile anche agli utenti standard) */}
                    {!isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTab('anagrafica');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-neutral-200 hover:text-yellow-300 hover:bg-neutral-900 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span>Tesseramento &amp; Anagrafica Band</span>
                      </button>
                    )}

                    {/* Profilo Insegnante & Resoconto Monte Ore Prenotate */}
                    <button
                      onClick={() => {
                        setIsTeacherReportModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs font-semibold text-neutral-200 hover:text-amber-300 hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Profilo Insegnante &amp; Monte Ore</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-neutral-500" />
                    </button>

                    {/* Riepilogo Mattutino (Ore 10:00) - Solo Admin */}
                    {isAdmin && (
                    <button
                      onClick={() => {
                        setIsBriefingModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <span className="text-sm">☕</span>
                      <span>Riepilogo Mattutino (Ore 10:00)</span>
                    </button>
                    )}


                    {/* Divider */}
                    <div className="h-px bg-neutral-800 my-1" />

                    {/* Quick Theme Switcher */}
                    <div className="px-3 py-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300">Tema Interfaccia:</span>
                      <ThemeToggle compact={false} showLabel={true} />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-neutral-800 my-1" />

                    {/* Logout */}
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Disconnetti dalla sessione</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Logout Button */}
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 text-xs font-bold border border-rose-500/30 transition-all shadow-sm cursor-pointer shrink-0"
                title="Disconnetti dalla sessione"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">Esci</span>
              </button>
            </div>

            {/* ── Mobile Right Actions ── */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {/* Theme Toggle */}
              <ThemeToggle compact={true} />

              {/* Mobile Menu Toggle (44px touch target) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all touch-manipulation cursor-pointer ${
                  isMobileMenuOpen
                    ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-500/30'
                    : 'bg-neutral-900 text-yellow-400 border-yellow-500/30 hover:bg-neutral-800'
                }`}
                aria-label="Apri menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Menu className="w-5 h-5 stroke-[2.5]" />
                )}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* ── Mobile Menu Drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200 print:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-neutral-950 border-l border-yellow-500/30 p-4 shadow-2xl flex flex-col z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-neutral-800 gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0 shadow-2xs">
                  <Music2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">SALA PROVE</h3>
                  <p className="text-[10px] text-blue-600 dark:text-yellow-400/80 font-bold truncate max-w-[150px]">{studioInfo.nome}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                aria-label="Chiudi menu"
                title="Chiudi menu"
                style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
              >
                <X className="w-5 h-5 text-white stroke-[2.5]" style={{ stroke: '#ffffff', color: '#ffffff' }} />
              </button>
            </div>

            {/* User Profile Card */}
            <div
              className={`my-3 p-3.5 rounded-xl border space-y-2.5 ${
                isAdmin
                  ? '!bg-blue-600 border-blue-500 shadow-md shadow-blue-500/20 text-white'
                  : 'bg-neutral-900/90 border-yellow-500/25'
              }`}
              style={isAdmin ? { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' } : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    isAdmin ? 'bg-white/20 text-white border border-white/30' : 'bg-yellow-400/20 border border-yellow-500/40 text-yellow-400'
                  }`}>
                    {user.avatar || (isAdmin ? '👑' : '👤')}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white" style={{ color: '#ffffff' }}>{user.nome}</h4>
                    <p
                      className={`user-email-text text-[10px] font-mono truncate max-w-[130px] ${isAdmin ? 'text-blue-100 font-medium' : 'text-neutral-400'}`}
                      style={isAdmin ? { color: '#dbeafe' } : undefined}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`admin-badge-pill text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-xs ${
                    isAdmin ? 'bg-white text-blue-700 border-white' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                  style={isAdmin ? { backgroundColor: '#ffffff', color: '#1d4ed8', borderColor: '#ffffff' } : undefined}
                >
                  {isAdmin ? 'ADMIN' : 'UTENTE'}
                </span>
              </div>

              {/* Quick actions inside drawer */}
              <div className="pt-2 border-t border-white/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: '#ffffff' }}
                  >
                    Tema Grafico:
                  </span>
                  <ThemeToggle compact={false} showLabel={true} />
                </div>
              </div>
            </div>

            {/* Navigation List in Drawer */}
            <div className="flex-1 space-y-1.5 py-1">
              <p className="text-[10px] uppercase font-bold text-yellow-500/60 px-2 tracking-wider">Tutte le Sezioni</p>

              {/* Calendario */}
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-active ${
                  activeTab === 'calendar'
                    ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                    : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Calendario &amp; Prenotazioni</span>
                </div>
                {activeTab === 'calendar' && <Check className="w-4 h-4 stroke-[3]" />}
              </button>

              {/* Schema Turni Settimana */}
              <button
                onClick={() => {
                  setActiveTab('turni');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-active ${
                  activeTab === 'turni'
                    ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                    : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>Schema Turni Settimana</span>
                </div>
                {activeTab === 'turni' && <Check className="w-4 h-4 stroke-[3]" />}
              </button>

              {/* Profilo Insegnante & Resoconto Monte Ore */}
              <button
                onClick={() => {
                  setIsTeacherReportModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all touch-manipulation touch-active"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Profilo Insegnante &amp; Monte Ore</span>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400/70" />
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('finance');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-active ${
                      activeTab === 'finance'
                        ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                        : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="w-4 h-4 shrink-0" />
                      <span>Spese &amp; Conto Mensile</span>
                    </div>
                    {expenses.length > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                        className={`w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-active ${
                          isItemActive
                            ? 'bg-yellow-400 text-black font-bold shadow-md shadow-yellow-500/30'
                            : 'text-neutral-200 hover:bg-neutral-900 hover:text-yellow-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.badge !== undefined && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isItemActive ? 'bg-black text-yellow-400' : 'bg-neutral-800 text-yellow-300'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          {isItemActive && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => {
                      setIsUserManagementOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-500/30 transition-all touch-manipulation touch-active mt-2"
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus className="w-4 h-4 text-yellow-400 shrink-0" />
                      <span>Gestione Utenti Supabase</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-400 text-black">
                      Admin
                    </span>
                  </button>
                  {/* Mobile: Riepilogo Mattutino 10:00 & WhatsApp */}
                  <div className="pt-2 pb-1 border-t border-yellow-500/20 mt-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsBriefingModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all touch-manipulation touch-active"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">☕</span>
                        <span>Riepilogo Mattutino (Ore 10:00)</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </button>

                    <button
                      onClick={() => {
                        setIsWhatsAppSettingsOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-emerald-300 hover:bg-neutral-900 border border-transparent transition-all touch-manipulation touch-active"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Notifiche WhatsApp Gruppo</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Actions in Drawer */}
            <div className="pt-3 border-t border-yellow-500/20 mt-auto pb-safe">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation touch-active"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnetti (Logout)</span>
              </button>
            </div>
          </div>
        </div>

      )}

      {/* Main Container (pb-24 on mobile ensures bottom navigation doesn't overlap content) */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 pb-24 md:pb-6 flex-1 w-full print:p-0 print:m-0 print:max-w-none print:w-full">
        {activeTab === 'calendar' && (
          <CalendarDashboardView onNavigateToTurni={() => setActiveTab('turni')} />
        )}
        {activeTab === 'turni' && <ShiftsView />}
        {activeTab === 'anagrafica' && (
          <AnagraficaView onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        {isAdmin && (
          <>
            {activeTab === 'bookings' && <BookingsView />}
            {activeTab === 'staff' && <StaffView onNavigateToTurni={() => setActiveTab('turni')} />}
            {activeTab === 'clients' && <ClientsView />}
            {activeTab === 'rooms' && (
              <RoomsView onNavigateToAnagrafica={() => setActiveTab('anagrafica')} />
            )}
            {activeTab === 'finance' && <FinanceView />}
          </>
        )}
        {!isAdmin && activeTab !== 'calendar' && activeTab !== 'turni' && activeTab !== 'anagrafica' && (
          <div className="bg-neutral-950 border border-rose-500/30 rounded-2xl p-8 text-center space-y-3 my-8 print:hidden">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Accesso Riservato</h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Questa sezione è riservata all'Amministratore. Il tuo account utente ha accesso al Calendario, allo Schema Turni e alla sezione Tesseramento.
            </p>
            <button
              onClick={() => setActiveTab('calendar')}
              className="px-4 py-2 min-h-[44px] bg-yellow-400 text-black font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-yellow-300 transition-all touch-manipulation touch-active"
            >
              Torna al Calendario
            </button>
          </div>
        )}
      </main>

      {/* ── Fixed Mobile Bottom Navigation Bar (Always thumb-accessible on smartphone) ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-950/95 border-t border-slate-200 dark:border-yellow-500/30 backdrop-blur-md pb-safe shadow-[0_-8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.85)] print:hidden"
        aria-label="Navigazione rapida mobile"
      >
        <div className={`grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} items-stretch h-14`}>
          {/* 1. Calendario */}
          <button
            onClick={() => {
              setActiveTab('calendar');
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
              activeTab === 'calendar' ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
            }`}
            title="Calendario Prenotazioni"
          >
            {activeTab === 'calendar' && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 dark:bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
            )}
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Calendario</span>
          </button>

          {/* 2. Schema Turni */}
          <button
            onClick={() => {
              setActiveTab('turni');
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
              activeTab === 'turni' ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
            }`}
            title="Schema Riepilogativo Turni"
          >
            {activeTab === 'turni' && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 dark:bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
            )}
            <CalendarClock className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Turni</span>
          </button>

          {isAdmin ? (
            <>
              {/* 3. Prenotazioni */}
              <button
                onClick={() => {
                  setActiveTab('bookings');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
                  activeTab === 'bookings' ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
                }`}
                title="Gestione Prenotazioni"
              >
                {activeTab === 'bookings' && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 dark:bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
                )}
                <div className="relative">
                  <Music2 className="w-5 h-5 mb-0.5" />
                  {bookings.length > 0 && (
                    <span className="absolute -top-1 -right-2.5 bg-blue-600 dark:bg-yellow-400 text-white dark:text-black text-[9px] font-black px-1 rounded-full leading-tight">
                      {bookings.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight">Prenota</span>
              </button>

              {/* 4. Conti & Spese */}
              <button
                onClick={() => {
                  setActiveTab('finance');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
                  activeTab === 'finance' ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
                }`}
                title="Conti e Spese Mensili"
              >
                {activeTab === 'finance' && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 dark:bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
                )}
                <div className="relative">
                  <Receipt className="w-5 h-5 mb-0.5" />
                  {expenses.length > 0 && (
                    <span className="absolute -top-1 -right-2.5 bg-blue-600 dark:bg-yellow-400 text-white dark:text-black text-[9px] font-black px-1 rounded-full leading-tight">
                      {expenses.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight">Conti</span>
              </button>

              {/* 5. Altro (Menu Drawer) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
                  isMobileMenuOpen || !['calendar', 'turni', 'bookings', 'finance'].includes(activeTab)
                    ? 'text-blue-600 dark:text-yellow-400 font-extrabold'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
                }`}
                title="Tutte le altre sezioni ed opzioni"
              >
                <Layers className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] leading-tight">Altro</span>
              </button>
            </>
          ) : (
            /* Standard User: Tesseramento + Menu */
            <>
              <button
                onClick={() => {
                  setActiveTab('anagrafica');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
                  activeTab === 'anagrafica' ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
                }`}
                title="Tesseramento e Anagrafica"
              >
                {activeTab === 'anagrafica' && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 dark:bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
                )}
                <UserPlus className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] leading-tight">Tessera</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`flex flex-col items-center justify-center relative touch-manipulation touch-active select-none min-h-[52px] ${
                  isMobileMenuOpen ? 'text-blue-600 dark:text-yellow-400 font-extrabold' : 'text-slate-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-yellow-300'
                }`}
                title="Profilo ed Opzioni"
              >
                <User className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] leading-tight">Profilo</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-yellow-500/25 py-4 pb-24 md:pb-4 text-center text-xs text-yellow-100/60 print:hidden">
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

      {/* Watcher automatico orario 10:00 per notifiche browser & WhatsApp */}
      <MorningNotificationWatcher
        onOpenBriefingModal={() => setIsBriefingModalOpen(true)}
      />

      {/* Modal Riepilogo Mattutino 10:00 */}
      <MorningBriefingModal
        isOpen={isBriefingModalOpen}
        onClose={() => setIsBriefingModalOpen(false)}
      />

      {/* Modal Impostazioni Notifiche & WhatsApp */}
      <WhatsAppSettingsModal
        isOpen={isWhatsAppSettingsOpen}
        onClose={() => setIsWhatsAppSettingsOpen(false)}
      />

      {/* Modal Profilo Insegnante & Resoconto Monte Ore */}
      <TeacherProfileReportModal
        isOpen={isTeacherReportModalOpen}
        onClose={() => setIsTeacherReportModalOpen(false)}
      />

      {/* Modal Gestione Utenti (Admin only) */}
      {isAdmin && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={() => setIsUserManagementOpen(false)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
