import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  Check,
  Copy,
  ExternalLink,
  X,
  WifiOff,
  MoreVertical,
  QrCode,
  Send,
  CheckCircle2,
  ArrowDown,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const android = /android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
    return outcome;
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    promptInstall,
  };
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-800 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Você está sem conexão à internet — navegando no modo offline do aplicativo.
      </span>
    </div>
  );
}

interface PWAInstallButtonProps {
  onOpenModal: () => void;
  isInstalled: boolean;
  isInstallable: boolean;
  onDirectInstall: () => void;
  variant?: 'header-internal' | 'header-client' | 'welcome-card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenModal,
  isInstalled,
  isInstallable,
  onDirectInstall,
  variant = 'header-internal',
}) => {
  if (isInstalled) {
    return (
      <button
        type="button"
        onClick={onOpenModal}
        title="Aplicativo instalado no dispositivo"
        className="px-3 py-2 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        <span className="hidden sm:inline">App Instalado</span>
      </button>
    );
  }

  const handleClick = () => {
    if (isInstallable) {
      onDirectInstall();
    } else {
      onOpenModal();
    }
  };

  if (variant === 'welcome-card') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <Smartphone className="w-4 h-4 text-red-400" />
        <span>
          {isInstallable
            ? 'Instalar Aplicativo no Celular (1 Clique)'
            : 'Instalar App no iPhone (iOS) ou Android'}
        </span>
      </button>
    );
  }

  if (variant === 'header-client') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Instalar o catálogo como aplicativo no iPhone (iOS) ou Android"
        className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-red-400" />
        <span>Instalar App (iOS / Android)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Abrir instalador do aplicativo para iPhone (iOS) e Android"
      className="px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
    >
      <Smartphone className="w-3.5 h-3.5 text-red-700" />
      <span>App iOS &amp; Android</span>
    </button>
  );
};

// Floating bottom banner automatically displayed on iPhone / iPad when not yet installed
export const IOSInstallPromptBanner: React.FC<{
  isIOS: boolean;
  isInstalled: boolean;
  onOpenIOSModal: () => void;
}> = ({ isIOS, isInstalled, onOpenIOSModal }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('campos_ios_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  if (!isIOS || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-slate-900 text-white border border-slate-700 rounded-2xl p-3.5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icon.svg?v=2"
            alt="Ícone CamposApp"
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">
              Instalar CamposApp no seu iPhone / iPad
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Toque em <Share className="w-3 h-3 text-blue-400 inline mx-0.5" />{' '}
              <strong>Compartilhar</strong> na barra do Safari e depois em{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem('campos_ios_banner_dismissed', '1');
            } catch {
              // ignore
            }
            setDismissed(true);
          }}
          className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 cursor-pointer"
          aria-label="Fechar aviso iOS"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <ArrowDown className="w-3 h-3 text-red-400 animate-bounce" />
          <span>Funciona em tela cheia no iOS</span>
        </span>
        <button
          type="button"
          onClick={onOpenIOSModal}
          className="px-3 py-1 text-[11px] font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
        >
          Ver Passo a Passo iOS / Baixar Perfil
        </button>
      </div>
    </div>
  );
};

// Generate an Apple iOS WebClip Configuration Profile (.mobileconfig) for direct download on iPhone/iPad
async function downloadIOSWebClipProfile(targetUrl: string, appTitle: string) {
  const cleanTitle = appTitle.replace(/[<>&"']/g, '');
  const cleanUrl = targetUrl.replace(/&/g, '&amp;');
  const uuid1 = '8C0A58E5-E425-4883-8499-0CF0D8A1FFB1';
  const uuid2 = '8C0A58E5-E425-4883-8499-0CF0D8A1FFB2';

  let iconDataXml = '';
  try {
    const res = await fetch('/apple-touch-icon.png?v=2');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Icon = window.btoa(binary);
      iconDataXml = `      <key>Icon</key>\n      <data>${base64Icon}</data>\n`;
    }
  } catch {
    // Fallback without embedded icon if fetch fails
  }

  const mobileconfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
${iconDataXml}      <key>IgnoreManifestScope</key>
      <false/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>${cleanTitle}</string>
      <key>PayloadDescription</key>
      <string>Atalho WebClip oficial do aplicativo ${cleanTitle} para iOS (iPhone e iPad)</string>
      <key>PayloadDisplayName</key>
      <string>${cleanTitle}</string>
      <key>PayloadIdentifier</key>
      <string>com.camposequipamentos.webclip.${Date.now()}</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${uuid1}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${cleanUrl}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Instala o aplicativo ${cleanTitle} na Tela de Início do seu iPhone ou iPad.</string>
  <key>PayloadDisplayName</key>
  <string>${cleanTitle} — Instalador iOS</string>
  <key>PayloadIdentifier</key>
  <string>com.camposequipamentos.profile.${Date.now()}</string>
  <key>PayloadOrganization</key>
  <string>Campos Equipamentos</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid2}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  const blob = new Blob([mobileconfigXml], {
    type: 'application/x-apple-aspen-config; charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'CamposApp-Instalador-iOS.mobileconfig';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

interface PWAInstallerModalProps {
  show: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInIframe: boolean;
  onPromptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  appUrl: string;
  clientCatalogUrl: string;
  sellerName: string;
  isClientMode: boolean;
}

export const PWAInstallerModal: React.FC<PWAInstallerModalProps> = ({
  show,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  isAndroid,
  isInIframe,
  onPromptInstall,
  appUrl,
  clientCatalogUrl,
  sellerName,
  isClientMode,
}) => {
  // Default to iOS tab unless user is on an Android device
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android'>(
    isAndroid && !isIOS ? 'android' : 'ios'
  );
  const [installMode, setInstallMode] = useState<'client' | 'internal'>(
    isClientMode ? 'client' : 'internal'
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(true);
  const [installResultMessage, setInstallResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isIOS) setSelectedPlatform('ios');
    else if (isAndroid) setSelectedPlatform('android');
  }, [isIOS, isAndroid]);

  useEffect(() => {
    setInstallMode(isClientMode ? 'client' : 'internal');
  }, [isClientMode]);

  if (!show) return null;

  const targetInstallUrl = installMode === 'client' ? clientCatalogUrl : appUrl;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    targetInstallUrl
  )}`;

  const handleCopyInstallLink = async () => {
    try {
      await navigator.clipboard.writeText(targetInstallUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = targetInstallUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleTriggerNativeInstall = async () => {
    const outcome = await onPromptInstall();
    if (outcome === 'accepted') {
      setInstallResultMessage(
        'Instalação iniciada! O ícone "CamposApp" será adicionado à tela inicial do seu celular.'
      );
    } else if (outcome === 'unavailable') {
      setInstallResultMessage(
        'Siga o passo a passo abaixo ou abra o link direto no navegador do celular para adicionar à Tela de Início.'
      );
    }
  };

  const handleDownloadIOSProfile = () => {
    const title = installMode === 'client' ? `Catálogo ${sellerName}` : 'CamposApp';
    downloadIOSWebClipProfile(targetInstallUrl, title);
    setInstallResultMessage(
      'Perfil iOS baixado! No seu iPhone ou iPad, abra Ajustes > "Perfil Baixado" (no topo) e toque em Instalar para adicionar o ícone na Tela de Início.'
    );
  };

  const whatsappShareText =
    installMode === 'client'
      ? `Olá! Acesse e instale o aplicativo do Catálogo Digital da Campos Equipamentos (atendimento ${sellerName}) no seu iPhone (iOS) ou Android: ${targetInstallUrl}`
      : `Link para instalar o aplicativo Painel & Catálogo Campos Equipamentos no iPhone (iOS) ou Android: ${targetInstallUrl}`;

  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon.svg?v=2"
              alt="Ícone CamposApp"
              className="w-11 h-11 rounded-xl shrink-0 shadow-xs"
            />
            <div>
              <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider block">
                Instalador Mobile Oficial · Compatível com iOS (iPhone / iPad) e Android
              </span>
              <h2 className="text-lg font-bold text-white font-sans">
                Instalar Aplicativo no iPhone (iOS) ou Android
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Status Banner if already installed */}
          {isInstalled && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div className="text-xs text-emerald-900">
                <p className="font-bold">Este aplicativo já está instalado neste aparelho!</p>
                <p className="text-emerald-700 mt-0.5">
                  Você pode abri-lo diretamente pelo ícone <strong>CamposApp</strong> na Tela de
                  Início do seu iPhone ou Android.
                </p>
              </div>
            </div>
          )}

          {/* Direct 1-Click Install Callout when Browser Supports beforeinstallprompt */}
          {isInstallable && !isInstalled && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide block mb-1">
                  Dispositivo Compatível com Instalação Direta
                </span>
                <h3 className="text-base font-bold text-white">
                  Instalar CamposApp com 1 Clique
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Adiciona o ícone oficial na tela inicial do seu aparelho, sem ocupar espaço da
                  memória e com funcionamento rápido em tela cheia.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerNativeInstall}
                className="px-5 py-3 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Agora</span>
              </button>
            </div>
          )}

          {installResultMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
              {installResultMessage}
            </div>
          )}

          {/* Platform Switcher: iPhone / iPad (iOS) vs Android */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Escolha o Sistema do seu Celular:
              </span>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('ios')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPlatform === 'ios'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-red-400" />
                  <span>iPhone / iPad (iOS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('android')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPlatform === 'android'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Android (Chrome)</span>
                </button>
              </div>
            </div>

            {selectedPlatform === 'ios' ? (
              <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 rounded mb-1">
                      Compatível com Todos os iPhones e iPads (iOS)
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Como Instalar no iPhone ou iPad (iOS)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      No iOS, o aplicativo é instalado direto pelo <strong>Safari</strong> (ou
                      Chrome no iOS) sem precisar passar pela App Store.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadIOSProfile}
                    className="px-3.5 py-2.5 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Baixar arquivo de perfil WebClip para iPhone/iPad"
                  >
                    <Download className="w-3.5 h-3.5 text-red-400" />
                    <span>Baixar Perfil Instalador iOS</span>
                  </button>
                </div>

                {/* 3 Visual Steps for iPhone / iPad */}
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-900">
                        Abra o link no Safari do seu iPhone ou iPad
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Se você estiver no computador agora, aponte a <strong>câmera do iPhone</strong> para o QR Code abaixo ou envie o link para o seu WhatsApp e abra no Safari.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                        <span>Toque no botão</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 font-semibold">
                          <Share className="w-3.5 h-3.5 text-blue-600" />
                          <span>Compartilhar</span>
                        </span>
                        <span>na barra do navegador</span>
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        No Safari do iPhone, ele fica centralizado na barra inferior (quadrado com uma seta apontando para cima).
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-red-700 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                        <span>Toque em</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-900 font-semibold">
                          <PlusSquare className="w-3.5 h-3.5 text-red-700" />
                          <span>Adicionar à Tela de Início</span>
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Depois confirme tocando em <strong>Adicionar</strong> no canto superior direito. O aplicativo <strong>CamposApp</strong> aparecerá na tela do seu iPhone com ícone próprio e abrirá em tela cheia!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interactive iPhone Home Screen Icon Preview */}
                <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/apple-touch-icon.png?v=2"
                      alt="Ícone iOS CamposApp"
                      className="w-12 h-12 rounded-xl border border-white/20 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">
                        Ícone Oficial para Tela de Início do iOS (180x180px)
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Configurado com modo tela cheia nativo da Apple (sem barra de endereço do Safari).
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQrCode((prev) => !prev)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{showQrCode ? 'Ocultar QR Code' : 'Mostrar QR Code iPhone'}</span>
                  </button>
                </div>

                {/* Scannable QR Code for iPhone Camera */}
                {showQrCode && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={qrCodeImageUrl}
                      alt="QR Code para instalar no iPhone"
                      className="w-28 h-28 rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="text-xs font-bold text-slate-900">
                        Aponte a Câmera do seu iPhone para este QR Code
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        A câmera do iOS reconhece o link automaticamente e abre o aplicativo direto no <strong>Safari do seu iPhone</strong>, pronto para você tocar em <strong>Compartilhar &rarr; Adicionar à Tela de Início</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Abra o link no Google Chrome do seu Android
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Toque no botão vermelho <strong>&ldquo;Abrir no Navegador para Instalar&rdquo;</strong> abaixo (ou envie o link para o seu WhatsApp e abra no celular).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-3 border-t border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Toque no menu do navegador</span>
                      <MoreVertical className="w-3.5 h-3.5 text-slate-700 inline" />
                      <span>(três pontinhos no canto superior direito)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Ou toque diretamente no botão <strong>&ldquo;Instalar App&rdquo;</strong> no topo da página.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-3 border-t border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-red-700 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-red-700 inline" />
                      <span>Selecione &ldquo;Instalar aplicativo&rdquo; ou &ldquo;Adicionar à tela inicial&rdquo;</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Confirme tocando em <strong>Instalar</strong>. O aplicativo <strong>CamposApp</strong> aparecerá junto com os demais aplicativos do seu celular!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mode Selector (For Internal Seller/Admin: Choose whether to install Internal App or Client Catalog App) */}
          {!isClientMode && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-slate-900 mb-2">
                2. Qual versão do aplicativo você deseja instalar no iOS / Android?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setInstallMode('internal')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    installMode === 'internal'
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">
                    1. App da Equipe (Vendedores &amp; Admin)
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      installMode === 'internal' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Acesso ao CRM de Leads, Links de Vendedores, Tabela e Segurança.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInstallMode('client')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    installMode === 'client'
                      ? 'bg-red-700 border-red-700 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">
                    2. App do Cliente (Catálogo de {sellerName})
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      installMode === 'client' ? 'text-red-100' : 'text-slate-500'
                    }`}
                  >
                    Abre direto no catálogo limpo de produtos vinculado ao vendedor.
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Direct Link + Open Outside Iframe + WhatsApp Send */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Link Direto para Abrir no Safari (iPhone/iPad) ou Chrome (Android)
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isInIframe
                    ? 'Importante no iPhone: toque em "Abrir no Safari / Navegador" abaixo para sair da pré-visualização e habilitar o botão "Adicionar à Tela de Início".'
                    : 'Envie este link para o seu WhatsApp ou abra no Safari do iPhone para instalar.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={targetInstallUrl}
                onClick={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyInstallLink}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={targetInstallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir no Safari / Navegador para Instalar</span>
              </a>

              <a
                href={whatsappShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Instalador por WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <span className="text-[11px] text-slate-500">
            Compatível com iPhone, iPad (iOS) e Android · Sem precisar de App Store
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
