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
      icon: <Building2 className="w-4 h-4 text-indigo-600" />,
    },
    {
      id: 'bookings',
      label: 'Prenotazioni',
      shortLabel: 'Prenotazioni',
      description: 'Planning sale prove, calendario slot e stato conferme',
      icon: <Music2 className="w-4 h-4 text-indigo-600" />,
      badge: bookings.length,
    },
    {
      id: 'staff',
      label: 'Operatori & Turni',
      shortLabel: 'Operatori',
      description: 'Staff, fasce orarie 24h, turni primari e assegnazione intelligente',
      icon: <Users className="w-4 h-4 text-emerald-600" />,
      badge: staff.length,
    },
    {
      id: 'clients',
      label: 'Clienti & Tesseramento',
      shortLabel: 'Clienti',
      description: 'Anagrafica band, stato tesseramento annuale e contatti',
      icon: <CreditCard className="w-4 h-4 text-sky-600" />,
      badge: clients.length,
    },
    {
      id: 'rooms',
      label: 'Sale Prove',
      shortLabel: 'Sale',
      description: 'Tariffe orarie, dotazione amplificatori, mixer e capienza',
      icon: <DoorOpen className="w-4 h-4 text-amber-600" />,
    },
    {
      id: 'finance',
      label: 'Spese & Conto Mensile',
      shortLabel: 'Spese & Conto',
      description: 'Bilancio entrate/uscite, canoni, bollette e saldo del mese',
      icon: <Receipt className="w-4 h-4 text-purple-600" />,
      badge: expenses.length,
    },
  ];

  const activeDropdownSection = dropdownSections.find((item) => item.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Music2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                    <span>SALA PROVE</span>
                    <span className="text-indigo-600 font-medium">• {studioInfo.nome}</span>
                  </h1>
                </div>
                <p className="text-[11px] text-slate-500 font-normal hidden sm:block">
                  {studioInfo.sottotitolo || 'Gestionale musicale: prenotazioni, turni operatori, tesseramento e spese'}
                </p>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={handleResetDemo}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Ripristina dati realistici dimostrativi"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">Dati Demo</span>
              </button>

              <div className="text-[11px] font-mono text-slate-500 bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/80 hidden lg:block">
                <span>Orario Continuo: 24/7</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Bar: Dashboard + Menù a Scomparsa */}
        <div className="border-t border-slate-200/90 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-2">
              <nav className="flex items-center space-x-2">
                {/* 1. Dashboard Tab (Direct & Always Visible) */}
                <button
                  onClick={() => {
                    setActiveTab('calendar');
                    setIsMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    activeTab === 'calendar'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                  <span>Dashboard</span>
                </button>

                {/* 2. Menù a Scomparsa for all other sections */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    aria-expanded={isMenuOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      activeTab !== 'calendar'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    {activeDropdownSection ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          {activeDropdownSection.icon}
                          <span>{activeDropdownSection.label}</span>
                        </span>
                        {activeDropdownSection.badge !== undefined && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900 font-mono">
                            {activeDropdownSection.badge}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4 text-slate-500" />
                        <span>Altre Sezioni</span>
                      </>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isMenuOpen ? 'rotate-180 text-indigo-600' : ''
                      }`}
                    />
                  </button>

                  {/* Menù a Scomparsa Dropdown Content */}
                  {isMenuOpen && (
                    <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Sezioni Gestionali</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {dropdownSections.length} sezioni
                        </span>
                      </div>

                      <div className="p-1.5 space-y-1">
                        {dropdownSections.map((item) => {
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                setIsMenuOpen(false);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                                isItemActive
                                  ? 'bg-indigo-50/80 text-slate-900 border border-indigo-100'
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  isItemActive
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.icon}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`text-xs sm:text-sm font-semibold truncate ${
                                      isItemActive ? 'text-indigo-900' : 'text-slate-800'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {item.badge !== undefined && (
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                                          isItemActive
                                            ? 'bg-indigo-200 text-indigo-950'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {item.badge}
                                      </span>
                                    )}
                                    {isItemActive && (
                                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                                    )}
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
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
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong>Gestione Sala Prove Musicale</strong> • Calcolo turni 24h, tesseramento e conto economico mensile
          </p>
          <p className="text-[11px] text-slate-400">
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
