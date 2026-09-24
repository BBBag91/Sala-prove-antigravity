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
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
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
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { resetToDemoData, studioInfo, bookings, staff, clients, expenses } = useApp();

  // Close dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

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
    <div className="min-h-screen bg-black text-yellow-50 flex flex-col antialiased selection:bg-yellow-400 selection:text-black">
      {/* Top Header — single compact row */}
      <header className="bg-neutral-950/95 border-b border-yellow-500/30 sticky top-0 z-40 shadow-lg shadow-black/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">

            {/* ── Logo / Brand ── */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-bold shadow-md shadow-yellow-500/30">
                <Music2 className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold tracking-tight text-white leading-tight flex items-center gap-1">
                  <span>SALA PROVE</span>
                  <span className="text-yellow-400 font-bold">• {studioInfo.nome}</span>
                </h1>
                <p className="text-[10px] text-yellow-400/60 leading-tight">
                  {studioInfo.sottotitolo || 'Associazione Culturale Musicale • Centro Prove & Registrazione'}
                </p>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="hidden sm:block w-px h-6 bg-yellow-500/20 shrink-0" />

            {/* ── Navigation (center, grows) ── */}
            <nav className="flex items-center gap-1.5 flex-1 min-w-0">

              {/* Dashboard tab */}
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeTab === 'calendar'
                    ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                    : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-transparent'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pannello di controllo</span>
                <span className="sm:hidden">Pannello</span>
              </button>

              {/* Dropdown sezioni */}
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab !== 'calendar'
                      ? 'bg-yellow-400 text-black border border-yellow-400 shadow-md shadow-yellow-500/30'
                      : 'text-yellow-100/70 hover:text-yellow-300 hover:bg-yellow-400/10 border border-yellow-500/30'
                  }`}
                >
                  {activeDropdownSection ? (
                    <>
                      {activeDropdownSection.icon}
                      <span className="hidden sm:inline">{activeDropdownSection.shortLabel}</span>
                      <span className="sm:hidden">{activeDropdownSection.shortLabel.split(' ')[0]}</span>
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
                      <span className="hidden sm:inline">Altre Sezioni</span>
                      <span className="sm:hidden">Sezioni</span>
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
                  <div className="absolute left-0 top-full mt-1.5 w-[calc(100vw-24px)] max-w-sm sm:w-96 bg-neutral-950 rounded-xl shadow-2xl border border-yellow-500/40 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-2 border-b border-yellow-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">
                        <Layers className="w-3 h-3 text-yellow-400" />
                        <span>Sezioni Gestionali</span>
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
            </nav>

            {/* ── Actions (right) ── */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-[10px] font-mono text-yellow-400 bg-neutral-900 px-2 py-1 rounded-md border border-yellow-500/30 hidden lg:block leading-tight">
                Orario Continuo: 24/7
              </div>
              <button
                onClick={handleResetDemo}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-yellow-400 text-yellow-400 hover:text-black text-xs font-bold border border-yellow-500/30 hover:border-yellow-400 transition-all shadow-sm group"
                title="Ripristina dati realistici dimostrativi"
              >
                <RotateCcw className="w-3.5 h-3.5 text-yellow-400 group-hover:text-black transition-colors" />
                <span className="hidden sm:inline">Dati Demo</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 flex-1 w-full">
        {activeTab === 'calendar' && <CalendarDashboardView />}
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
      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-yellow-500/25 py-4 text-center text-xs text-yellow-100/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong className="text-yellow-400 font-bold">Gestione Sala Prove Musicale</strong> • <span className="text-neutral-300">Calcolo turni 24h, tesseramento e conto economico mensile</span>
          </p>
          <p className="text-[11px] text-yellow-500/70">
            Dati salvati in locale con sincronizzazione continua
          </p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
