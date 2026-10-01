import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  HelpCircle,
  Settings2,
  ExternalLink,
  Bell,
  Sparkles,
  Info,
  Link as LinkIcon,
  Search,
  RefreshCw,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WhatsAppNotificationConfig, WhatsAppProvider } from '../types';
import {
  sendWhatsAppViaApi,
  requestBrowserNotificationPermission,
  fetchWhatsAppGroups,
  resolveGroupInviteLink,
  WhatsAppGroupItem,
} from '../services/whatsappService';

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppSettingsModal: React.FC<WhatsAppSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { studioInfo, updateStudioInfo } = useApp();

  const currentConfig: WhatsAppNotificationConfig = studioInfo.whatsappConfig || {
    enabled: true,
    provider: 'greenapi',
    orarioNotifica: '10:00',
    chatId: '',
    groupName: '',
    groupInviteLink: '',
    includiStatoPagamenti: true,
    includiDotazione: false,
    autoSendMorning: true,
    browserNotificationEnabled: true,
  };

  const [enabled, setEnabled] = useState(currentConfig.enabled ?? true);
  const [provider, setProvider] = useState<WhatsAppProvider>(currentConfig.provider || 'greenapi');
  const [instanceId, setInstanceId] = useState(currentConfig.instanceId || '');
  const [token, setToken] = useState(currentConfig.token || '');
  const [chatId, setChatId] = useState(currentConfig.chatId || '');
  const [groupName, setGroupName] = useState(currentConfig.groupName || '');
  const [groupInviteLink, setGroupInviteLink] = useState(currentConfig.groupInviteLink || '');
  const [webhookUrl, setWebhookUrl] = useState(currentConfig.webhookUrl || '');
  const [orarioNotifica, setOrarioNotifica] = useState(currentConfig.orarioNotifica || '10:00');
  const [includiStatoPagamenti, setIncludiStatoPagamenti] = useState(
    currentConfig.includiStatoPagamenti ?? true
  );
  const [includiDotazione, setIncludiDotazione] = useState(
    currentConfig.includiDotazione ?? false
  );
  const [autoSendMorning, setAutoSendMorning] = useState(
    currentConfig.autoSendMorning ?? true
  );
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(
    currentConfig.browserNotificationEnabled ?? true
  );

  // Group discovery state
  const [discoveredGroups, setDiscoveredGroups] = useState<WhatsAppGroupItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [groupActionMessage, setGroupActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<'setup' | 'group' | 'test'>('group');

  useEffect(() => {
    if (isOpen && studioInfo.whatsappConfig) {
      const c = studioInfo.whatsappConfig;
      setEnabled(c.enabled ?? true);
      setProvider(c.provider || 'greenapi');
      setInstanceId(c.instanceId || '');
      setToken(c.token || '');
      setChatId(c.chatId || '');
      setGroupName(c.groupName || '');
      setGroupInviteLink(c.groupInviteLink || '');
      setWebhookUrl(c.webhookUrl || '');
      setOrarioNotifica(c.orarioNotifica || '10:00');
      setIncludiStatoPagamenti(c.includiStatoPagamenti ?? true);
      setIncludiDotazione(c.includiDotazione ?? false);
      setAutoSendMorning(c.autoSendMorning ?? true);
      setBrowserNotificationEnabled(c.browserNotificationEnabled ?? true);
      setTestResult(null);
      setGroupActionMessage(null);
      setIsSaved(false);
    }
  }, [isOpen, studioInfo.whatsappConfig]);

  if (!isOpen) return null;

  // Caricamento automatico gruppi da WhatsApp
  const handleFetchGroups = async () => {
    if (!instanceId || !token) {
      setGroupActionMessage({
        type: 'error',
        text: 'Inserisci prima l\'Instance ID e il Token per poter cercare i gruppi dal tuo WhatsApp.',
      });
      return;
    }

    setIsLoadingGroups(true);
    setGroupActionMessage(null);

    const res = await fetchWhatsAppGroups({
      provider,
      instanceId: instanceId.trim(),
      token: token.trim(),
    });

    setIsLoadingGroups(false);

    if (res.success && res.groups) {
      if (res.groups.length === 0) {
        setGroupActionMessage({
          type: 'error',
          text: 'Nessun gruppo trovato sul numero WhatsApp collegato. Verifica di aver inquadrato il QR Code.',
        });
      } else {
        setDiscoveredGroups(res.groups);
        setGroupActionMessage({
          type: 'success',
          text: `Trovati ${res.groups.length} gruppi WhatsApp. Seleziona quello desiderato dall'elenco!`,
        });
      }
    } else {
      setGroupActionMessage({
        type: 'error',
        text: res.error || 'Errore nel recupero dei gruppi. Verifica credenziali e stato del QR Code.',
      });
    }
  };

  // Risoluzione automatica link invito gruppo (es. https://chat.whatsapp.com/...)
  const handleResolveInviteLink = async () => {
    if (!groupInviteLink.trim()) {
      setGroupActionMessage({
        type: 'error',
        text: 'Incolla il link d\'invito del gruppo (es. https://chat.whatsapp.com/...).',
      });
      return;
    }

    if (!instanceId || !token) {
      setGroupActionMessage({
        type: 'error',
        text: 'Inserisci prima l\'Instance ID e il Token per poter collegare il gruppo.',
      });
      return;
    }

    setIsResolvingLink(true);
    setGroupActionMessage(null);

    const res = await resolveGroupInviteLink(
      {
        provider,
        instanceId: instanceId.trim(),
        token: token.trim(),
      },
      groupInviteLink.trim()
    );

    setIsResolvingLink(false);

    if (res.success && res.chatId) {
      setChatId(res.chatId);
      if (res.groupName) setGroupName(res.groupName);
      if (res.groups && res.groups.length > 0) {
        setDiscoveredGroups(res.groups);
      }
      setGroupActionMessage({
        type: 'success',
        text: `✅ Gruppo collegato con successo: "${res.groupName || 'Gruppo Staff'}"! (${res.chatId})`,
      });
    } else {
      setGroupActionMessage({
        type: 'error',
        text: res.error || 'Impossibile collegare il gruppo. Verifica che il QR Code sia stato scansionato su green-api.com.',
      });
    }
  };

  const handleSelectDiscoveredGroup = (selectedId: string) => {
    const found = discoveredGroups.find((g) => g.id === selectedId);
    if (found) {
      setChatId(found.id);
      setGroupName(found.name);
      setGroupActionMessage({
        type: 'success',
        text: `✅ Gruppo impostato: "${found.name}"!`,
      });
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newConfig: WhatsAppNotificationConfig = {
      enabled,
      provider,
      instanceId: instanceId.trim(),
      token: token.trim(),
      chatId: chatId.trim(),
      groupName: groupName.trim(),
      groupInviteLink: groupInviteLink.trim(),
      webhookUrl: webhookUrl.trim(),
      orarioNotifica: orarioNotifica.trim() || '10:00',
      includiStatoPagamenti,
      includiDotazione,
      autoSendMorning,
      browserNotificationEnabled,
      lastAutoSentDate: currentConfig.lastAutoSentDate,
    };

    updateStudioInfo({
      ...studioInfo,
      whatsappConfig: newConfig,
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const handleTestSend = async () => {
    if (!chatId) {
      setTestResult({
        success: false,
        message: 'Imposta prima un gruppo WhatsApp (tramite link d\'invito o ricerca gruppi) prima di inviare il test.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const testConfig: WhatsAppNotificationConfig = {
      enabled: true,
      provider,
      instanceId: instanceId.trim(),
      token: token.trim(),
      chatId: chatId.trim(),
      webhookUrl: webhookUrl.trim(),
    };

    const targetLabel = groupName ? `"${groupName}"` : 'questo gruppo';
    const testMessage = `🧪 *TEST NOTIFICHE SALA PROVE*\n\nConnessione a WhatsApp riuscita con successo per *${studioInfo.nome || 'Sala Prove'}*!\nLe notifiche mattutine (ore ${orarioNotifica}) arriveranno regolarmente su ${targetLabel}. 🎶`;

    const res = await sendWhatsAppViaApi(testConfig, testMessage);
    setIsTesting(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: `✅ Fantastico! Messaggio di test inviato e ricevuto sul gruppo WhatsApp ${groupName ? `"${groupName}"` : ''}!`,
      });
    } else {
      setTestResult({
        success: false,
        message: `❌ Errore nell'invio: ${res.error || 'Verifica le credenziali o l\'ID gruppo inserito.'}`,
      });
    }
  };

  const handleEnableBrowserNotifications = async () => {
    const granted = await requestBrowserNotificationPermission();
    if (granted) {
      setBrowserNotificationEnabled(true);
      alert('✅ Permesso notifiche browser concesso! Riceverai un avviso alle 10:00 sul computer o telefono.');
    } else {
      alert('⚠️ Permesso notifiche non concesso. Puoi abilitarlo dalle impostazioni del browser (icona lucchetto nella barra degli indirizzi).');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Configurazione Notifica WhatsApp Gruppo Staff
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ore {orarioNotifica}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Imposta il gruppo WhatsApp dove inviare in automatico il riepilogo eventi e turni
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Step Tabs */}
        <div className="px-5 py-2.5 bg-neutral-950/70 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveStepTab('group')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeStepTab === 'group'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Imposta Gruppo WhatsApp</span>
            {chatId && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveStepTab('setup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeStepTab === 'setup'
                ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-yellow-400" />
            <span>2. Connessione Gateway ({provider.toUpperCase()})</span>
            {instanceId && token && <Check className="w-3 h-3 text-yellow-400 stroke-[3]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveStepTab('test')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeStepTab === 'test'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            <span>3. Test Invio &amp; Orario</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Main Activation Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Invio Automatico Mattutino</p>
                <p className="text-xs text-neutral-400">
                  Ogni mattina alle ore <b className="text-yellow-400">{orarioNotifica}</b> invia il riepilogo al gruppo impostato
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={enabled && autoSendMorning}
                onChange={(e) => {
                  setEnabled(e.target.checked);
                  setAutoSendMorning(e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* TAB 1: IMPOSTA GRUPPO WHATSAPP */}
          {activeStepTab === 'group' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Badge Stato Attuale Gruppo */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                chatId
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
              }`}>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {chatId ? 'Gruppo WhatsApp Attualmente Impostato:' : 'Nessun Gruppo Impostato:'}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-white truncate">
                    {groupName || (chatId ? chatId : 'Devi ancora selezionare o collegare il gruppo')}
                  </p>
                  {chatId && (
                    <p className="text-[11px] font-mono text-emerald-400/80 truncate">
                      ID: {chatId}
                    </p>
                  )}
                </div>
                {chatId ? (
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                )}
              </div>

              {/* Metodo A (Opzione 2 dell'utente): Ricerca Automatica e Menu a Tendina Gruppi */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-yellow-500/30 space-y-3 shadow-md shadow-black/40">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-bold shrink-0">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Scegli dai Gruppi del Tuo WhatsApp (Opzione 2)
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Carica direttamente l'elenco a tendina dei gruppi dal tuo WhatsApp
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchGroups}
                    disabled={isLoadingGroups}
                    className="px-3.5 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGroups ? 'animate-spin' : ''}`} />
                    <span>{isLoadingGroups ? 'Caricamento in corso...' : 'Carica i Miei Gruppi'}</span>
                  </button>
                </div>

                {/* Se mancano Instance ID e Token, mostrali direttamente qui per non dover cambiare scheda */}
                {(!instanceId || !token) && (
                  <div className="p-3 bg-neutral-900 rounded-lg border border-yellow-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-yellow-300">
                        🔑 Inserisci le tue 2 chiavi {provider === 'greenapi' ? 'Green API' : 'UltraMsg'} per caricare i gruppi:
                      </span>
                      <a
                        href={provider === 'greenapi' ? 'https://green-api.com/' : 'https://ultramsg.com/'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-yellow-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Apri {provider === 'greenapi' ? 'Green API' : 'UltraMsg'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={instanceId}
                        onChange={(e) => setInstanceId(e.target.value)}
                        placeholder={provider === 'greenapi' ? 'idInstance (es. 1101823912)' : 'Instance ID'}
                        className="px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:border-yellow-400 focus:outline-hidden"
                      />
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={provider === 'greenapi' ? 'apiTokenInstance' : 'Token API'}
                        className="px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:border-yellow-400 focus:outline-hidden"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      💡 <i>Dopo aver inquadrato il QR Code con WhatsApp sul sito {provider === 'greenapi' ? 'Green API' : 'UltraMsg'}, incolla le 2 chiavi qui sopra e premi <b>"Carica i Miei Gruppi"</b>.</i>
                    </p>
                  </div>
                )}

                {/* Menu a tendina dei gruppi WhatsApp trovati */}
                {discoveredGroups.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-semibold text-emerald-300">
                      Seleziona il gruppo desiderato ({discoveredGroups.length} gruppi trovati):
                    </label>
                    <select
                      value={chatId}
                      onChange={(e) => handleSelectDiscoveredGroup(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-emerald-500/50 text-xs font-bold text-white focus:border-emerald-400 focus:outline-hidden cursor-pointer"
                    >
                      <option value="">-- Clicca qui e scegli il gruppo dello staff --</option>
                      {discoveredGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          👥 {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 italic">
                    {instanceId && token
                      ? 'Premi il tasto giallo "Carica i Miei Gruppi" qui sopra per visualizzare il menu a tendina.'
                      : 'Inserisci le credenziali qui sopra per far comparire il menu a tendina con i tuoi gruppi WhatsApp.'}
                  </p>
                )}
              </div>

              {/* Metodo B: Link di Invito Gruppo (Alternativa Rapida) */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        In alternativa: Tramite Link di Invito Gruppo
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Incolla il link d'invito WhatsApp (es. https://chat.whatsapp.com/...)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={groupInviteLink}
                    onChange={(e) => setGroupInviteLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/ABC123xyz..."
                    className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:border-emerald-400 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveInviteLink}
                    disabled={isResolvingLink || !groupInviteLink.trim()}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isResolvingLink ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Collegamento...</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Collega Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Metodo C: Inserimento Manuale Codice Gruppo */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-400">
                    Oppure inserisci manualmente l'ID o nome del gruppo:
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nome visuale (es. Staff Sala Prove)"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-white focus:border-yellow-400 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="ID univoco (es. 120363...@g.us)"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:border-yellow-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Messaggio feedback azione gruppo */}
              {groupActionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                    groupActionMessage.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{groupActionMessage.text}</span>
                  <button
                    type="button"
                    onClick={() => setGroupActionMessage(null)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONNESSIONE GATEWAY (INSTANCE & TOKEN) */}
          {activeStepTab === 'setup' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200 leading-relaxed">
                ℹ️ <b>Come collegare il tuo WhatsApp Business:</b> Registrati gratis su <b>Green API</b> (piano Developer gratuito) o <b>UltraMsg</b>, inquadra il QR Code con il tuo telefono e copia qui sotto le 2 chiavi.
              </div>

              {/* Scelta Provider */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('greenapi')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    provider === 'greenapi'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-bold block flex items-center gap-1.5">
                    🟢 Green API (Consigliato)
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Piano gratuito Developer disponibile, ottimo per gruppi.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('ultramsg')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    provider === 'ultramsg'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-bold block flex items-center gap-1.5">
                    ⚡ UltraMsg Gateway
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Prova gratuita, API molto rapida per WhatsApp Business.
                  </span>
                </button>
              </div>

              {/* Campi Credenziali */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      {provider === 'greenapi' ? 'idInstance' : 'Instance ID'} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                      placeholder={provider === 'greenapi' ? 'Es. 1101823912' : 'Es. instance12345'}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:border-yellow-400 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      {provider === 'greenapi' ? 'apiTokenInstance' : 'Token API'} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Token segreto fornito dalla dashboard"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:border-yellow-400 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Non hai ancora un account?</span>
                  <a
                    href={provider === 'greenapi' ? 'https://green-api.com/' : 'https://ultramsg.com/'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-yellow-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Apri {provider === 'greenapi' ? 'Green API' : 'UltraMsg'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEST INVIO & ORARIO */}
          {activeStepTab === 'test' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Orario Invio Automatico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-yellow-400" />
                    Orario Notifica Mattutina
                  </label>
                  <input
                    type="time"
                    value={orarioNotifica}
                    onChange={(e) => setOrarioNotifica(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-sm font-bold text-yellow-300 focus:border-yellow-400 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Default impostato: <b className="text-yellow-400">10:00</b>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-yellow-400" />
                    Notifiche Desktop Browser
                  </label>
                  <button
                    type="button"
                    onClick={handleEnableBrowserNotifications}
                    className="w-full py-2 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-yellow-500/30 text-yellow-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Abilita Notifica sul Dispositivo</span>
                  </button>
                  <p className="text-[11px] text-neutral-400">
                    Notifica di sistema alle 10:00 se il gestionale è aperto
                  </p>
                </div>
              </div>

              {/* Pulsante Invia Messaggio di Prova */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Verifica In Tempo Reale
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      Invia subito un messaggio di prova al gruppo per verificare che arrivi correttamente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSend}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTesting ? 'Invio test in corso...' : 'Invia Test Ora'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-semibold'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Chiudi
          </button>

          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Salvato!
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs shadow-md shadow-yellow-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salva Configurazione</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
