import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Link2,
  Copy,
  Check,
  Phone,
  UserCheck,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  ArrowUpRight,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  Upload,
  Camera,
  Star,
  Pencil,
  Tag,
  Lock,
  Shield,
  KeyRound,
  LogOut,
  Calendar,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Heart,
} from 'lucide-react';
import { exportLeadsAndViewsToPdf } from './utils/exportLeadsPdf';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { EmailLoginForm, PasswordRecoveryOverlay } from './components/EmailLoginForm';
import {
  db,
  auth,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  handleFirestoreError,
  OperationType,
} from './backend';
import {
  Seller,
  Segment,
  Product,
  Lead,
  ProductView,
  LeadStatus,
  WorkspacePermissions,
  StaffMember,
  VALIDATION_LIMITS,
  WORKSPACE_OWNER_ID,
  DEFAULT_COMPANY_LOGO,
} from './types';
import {
  SecurityTabView,
  AdminLoginModal,
  StaffPermissionKey,
  NewStaffMemberPayload,
  SellerPermissionPreset,
} from './components/SecurityAndAdminModal';
import {
  usePWAInstall,
  PWAInstallButton,
  PWAInstallerModal,
  OfflineIndicator,
  IOSInstallPromptBanner,
} from './components/PWAInstaller';
import {
  INITIAL_PRODUCTS,
  INITIAL_SEGMENTS,
  IMG_PANIFICACAO,
  IMG_REFRIGERACAO,
  IMG_VITRINE,
  IMG_COCCAO,
  IMG_ACOUGUE,
  IMG_BALANCA,
  IMG_SPEC_INOX,
  IMG_SPEC_NR12,
} from './seedData';
import {
  buildProductGalleryFromMetadata,
  generateProductSpecificPhoto,
  isGenericPlaceholderImage,
} from './productPhotoGenerator';

type WorkspaceTab = 'catalogo' | 'leads' | 'vendedores' | 'produtos' | 'seguranca';

const ADMIN_OWNER_EMAIL =
  (import.meta.env.VITE_ADMIN_OWNER_EMAIL as string | undefined)?.trim().toLowerCase() ||
  'adrianonascimentu@gmail.com';

const DEFAULT_PERMISSIONS_STATE: Omit<WorkspacePermissions, 'updatedAt'> = {
  id: 'workspace_config',
  ownerId: WORKSPACE_OWNER_ID,
  // O que os clientes podem ver no link do catálogo
  clientShowPrices: true,
  clientShowProductCode: true,
  clientShowManufacturerRef: true,
  clientShowDimensionsAndMaterial: true,
  clientShowPhotosCount: true,
  clientHideOutOfStock: false,
  clientShowWhatsappButton: true,
  clientRequireIdentification: false,
  // O que os vendedores podem ver e editar no painel interno
  sellerCanEditProducts: false,
  sellerCanEditPrices: false,
  sellerCanCreateOrDeleteProducts: false,
  sellerCanManagePhotos: false,
  sellerCanManageSegments: false,
  sellerCanManageSellers: false,
  sellerCanDeleteLeads: false,
  sellerCanViewPdfTable: true,
  sellerCanChangeLogo: false,
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo Lead',
  em_atendimento: 'Em Atendimento',
  proposta: 'Proposta Enviada',
  convertido: 'Convertido',
};

const PRESET_GALLERY_OPTIONS = [
  { label: 'Refrigeração & Auto Serviço', url: IMG_REFRIGERACAO },
  { label: 'Panificação & Massas', url: IMG_PANIFICACAO },
  { label: 'Vitrines & Confeitaria', url: IMG_VITRINE },
  { label: 'Cocção, Fogões & Fornos', url: IMG_COCCAO },
  { label: 'Açougue & Frios', url: IMG_ACOUGUE },
  { label: 'Balanças & Inox', url: IMG_BALANCA },
];


function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

type LeadDateFilter = 'todos' | 'hoje' | '7dias' | '30dias' | 'personalizado';

function extractTimestampDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? null : ts;
  }
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    const d = (ts as { toDate: () => Date }).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  if (typeof ts === 'number' || typeof ts === 'string') {
    const parsed = new Date(ts);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getLeadCaptureDate(lead: Lead): Date {
  return (
    extractTimestampDate(lead.createdAt) ||
    extractTimestampDate(lead.updatedAt) ||
    new Date()
  );
}

function matchesLeadDateFilter(
  lead: Lead,
  dateFilter: LeadDateFilter,
  customStartStr?: string,
  customEndStr?: string
): boolean {
  if (dateFilter === 'todos') return true;

  const leadDate = getLeadCaptureDate(lead);
  const leadMs = leadDate.getTime();
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  if (dateFilter === 'hoje') {
    return leadMs >= startOfToday;
  }

  if (dateFilter === '7dias') {
    const sevenDaysAgoStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0
    ).getTime();
    const rollingSevenDays = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return leadMs >= Math.min(sevenDaysAgoStart, rollingSevenDays);
  }

  if (dateFilter === '30dias') {
    const thirtyDaysAgoStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 29,
      0,
      0,
      0,
      0
    ).getTime();
    const rollingThirtyDays = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return leadMs >= Math.min(thirtyDaysAgoStart, rollingThirtyDays);
  }

  if (dateFilter === 'personalizado') {
    let minMs = -Infinity;
    let maxMs = Infinity;

    if (customStartStr && customStartStr.trim()) {
      const [y, m, d] = customStartStr.split('-').map(Number);
      if (y && m && d) {
        minMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      }
    }
    if (customEndStr && customEndStr.trim()) {
      const [y, m, d] = customEndStr.split('-').map(Number);
      if (y && m && d) {
        maxMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      }
    }
    return leadMs >= minMs && leadMs <= maxMs;
  }

  return true;
}

function formatDateTime(ts: unknown): string {
  const d = extractTimestampDate(ts);
  if (!d) return 'Agora mesmo';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned.length >= 2 ? cleaned : `id-${Date.now()}`;
}

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function parseProductSegments(categoryStr: string): string[] {
  if (!categoryStr) return [];
  return categoryStr
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatProductSegments(segmentNames: string[]): string {
  const unique = Array.from(new Set(segmentNames.map((s) => s.trim()).filter(Boolean)));
  const joined = unique.join(' | ');
  return (joined || 'Geral').slice(0, VALIDATION_LIMITS.PRODUCT_CATEGORY_MAX);
}

function productBelongsToSegment(product: Product, segmentName: string): boolean {
  const target = segmentName.trim().toLowerCase();
  if (!target) return false;
  return parseProductSegments(product.category).some(
    (seg) => seg.toLowerCase() === target
  );
}

function parseProductCodeAndRef(product: { sku: string; dimensions?: string }): {
  productCode: string;
  manufacturerRef: string;
  cleanDimensions: string;
} {
  const rawSku = (product.sku || '').trim();
  const rawDims = (product.dimensions || '').trim();

  let productCode = rawSku;
  let manufacturerRef = '';

  const skuParts = rawSku
    .split(/[·|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (skuParts.length >= 2) {
    productCode = skuParts[0].replace(/^(c[oó]d\.?\s*)/i, '').trim() || skuParts[0];
    manufacturerRef = skuParts
      .slice(1)
      .join(' · ')
      .replace(/^(ref\.?\s*fab\.?:?\s*|c[oó]d\.?\s*fab\.?:?\s*)/i, '')
      .trim();
  } else {
    productCode = rawSku.replace(/^(c[oó]d\.?\s*)/i, '').trim() || rawSku;
  }

  let cleanDimensions = rawDims;
  const dimParts = rawDims
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  if (dimParts.length > 0 && /^(c[oó]d\.?\s*fab|ref\.?\s*fab)/i.test(dimParts[0])) {
    const extractedFromDim = dimParts[0]
      .replace(/^(c[oó]d\.?\s*fab\.?:?\s*|ref\.?\s*fab\.?:?\s*)/i, '')
      .trim();
    if (!manufacturerRef && extractedFromDim) {
      manufacturerRef = extractedFromDim;
    }
    cleanDimensions = dimParts.slice(1).join(' · ').trim() || rawDims;
  }

  return {
    productCode: productCode || 'S/CÓD',
    manufacturerRef,
    cleanDimensions: cleanDimensions || 'Padrão Comercial',
  };
}

function formatSkuWithCodeAndRef(productCode: string, manufacturerRef: string): string {
  const cleanCode = productCode.replace(/^(c[oó]d\.?\s*)/i, '').trim();
  const cleanRef = manufacturerRef
    .replace(/^(ref\.?\s*fab\.?:?\s*|c[oó]d\.?\s*fab\.?:?\s*)/i, '')
    .trim();
  const baseCode = cleanCode ? `CÓD ${cleanCode}` : 'CÓD 00';
  const combined = cleanRef ? `${baseCode} · ${cleanRef}` : baseCode;
  return combined.slice(0, VALIDATION_LIMITS.PRODUCT_SKU_MAX);
}

interface ImageOptimizationStats {
  dataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  savingsPercent: number;
  formatLabel: string;
}

function estimateBase64Bytes(dataUrl: string): number {
  const base64Part = dataUrl.split(',')[1] || '';
  return Math.round((base64Part.length * 3) / 4);
}

function formatKilobytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Render image onto target canvas using multi-step 50% halving for maximum sharpness (Lanczos-like anti-aliasing)
function renderHighQualityScaledCanvas(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  preserveAlpha: boolean
): HTMLCanvasElement {
  let curW = img.naturalWidth || img.width;
  let curH = img.naturalHeight || img.height;

  // Step down progressively in 2x stages if source is much larger than target (e.g., 12MP smartphone camera)
  let workCanvas = document.createElement('canvas');
  let workCtx = workCanvas.getContext('2d');

  if (curW > targetW * 2 || curH > targetH * 2) {
    let nextW = Math.max(targetW, Math.round(curW * 0.5));
    let nextH = Math.max(targetH, Math.round(curH * 0.5));
    workCanvas.width = nextW;
    workCanvas.height = nextH;
    if (workCtx) {
      workCtx.imageSmoothingEnabled = true;
      workCtx.imageSmoothingQuality = 'high';
      workCtx.drawImage(img, 0, 0, nextW, nextH);
    }
    curW = nextW;
    curH = nextH;

    while (curW > targetW * 2 || curH > targetH * 2) {
      nextW = Math.max(targetW, Math.round(curW * 0.5));
      nextH = Math.max(targetH, Math.round(curH * 0.5));
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextW;
      stepCanvas.height = nextH;
      const stepCtx = stepCanvas.getContext('2d');
      if (stepCtx) {
        stepCtx.imageSmoothingEnabled = true;
        stepCtx.imageSmoothingQuality = 'high';
        stepCtx.drawImage(workCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
      }
      workCanvas = stepCanvas;
      curW = nextW;
      curH = nextH;
    }
  } else {
    workCanvas.width = curW;
    workCanvas.height = curH;
    if (workCtx) {
      workCtx.imageSmoothingEnabled = true;
      workCtx.imageSmoothingQuality = 'high';
      workCtx.drawImage(img, 0, 0, curW, curH);
    }
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext('2d');
  if (finalCtx) {
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    if (!preserveAlpha) {
      finalCtx.fillStyle = '#FFFFFF';
      finalCtx.fillRect(0, 0, targetW, targetH);
    } else {
      finalCtx.clearRect(0, 0, targetW, targetH);
    }
    finalCtx.drawImage(workCanvas, 0, 0, curW, curH, 0, 0, targetW, targetH);
  }
  return finalCanvas;
}

async function optimizeImageFileWithStats(
  file: File,
  maxWidth = 1280,
  maxHeight = 960,
  preferAlpha = false,
  targetMaxBytes = 68 * 1024
): Promise<ImageOptimizationStats> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        let width = srcW;
        let height = srcH;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = renderHighQualityScaledCanvas(img, width, height, preferAlpha);

        // Try WebP first (supports both transparency and 40-60% smaller file size than JPEG at higher sharpness)
        const testWebp = canvas.toDataURL('image/webp', 0.86);
        const supportsWebp = testWebp.startsWith('data:image/webp');
        const mimeType = supportsWebp ? 'image/webp' : 'image/jpeg';
        const formatLabel = supportsWebp ? 'WebP HD' : 'JPEG HD';

        // Adaptive quality search: pick the highest quality that fits within targetMaxBytes
        const qualitySteps = [0.88, 0.84, 0.8, 0.76, 0.72];
        let bestDataUrl = '';

        for (const q of qualitySteps) {
          const candidate = canvas.toDataURL(mimeType, q);
          bestDataUrl = candidate;
          const bytes = estimateBase64Bytes(candidate);
          if (bytes <= targetMaxBytes && candidate.length <= VALIDATION_LIMITS.PRODUCT_IMG_MAX) {
            break;
          }
        }

        // If the image is extremely detailed and still exceeds targetMaxBytes, scale to 1040x780 HD at high quality (0.82)
        if (
          estimateBase64Bytes(bestDataUrl) > targetMaxBytes * 1.25 ||
          bestDataUrl.length > VALIDATION_LIMITS.PRODUCT_IMG_MAX
        ) {
          const fallbackW = Math.max(1, Math.round(width * 0.82));
          const fallbackH = Math.max(1, Math.round(height * 0.82));
          const compactCanvas = renderHighQualityScaledCanvas(
            img,
            fallbackW,
            fallbackH,
            preferAlpha
          );
          for (const q of [0.84, 0.78, 0.72]) {
            const candidate = compactCanvas.toDataURL(mimeType, q);
            bestDataUrl = candidate;
            if (
              estimateBase64Bytes(candidate) <= targetMaxBytes &&
              candidate.length <= VALIDATION_LIMITS.PRODUCT_IMG_MAX
            ) {
              width = fallbackW;
              height = fallbackH;
              break;
            }
          }
        }

        const optimizedBytes = estimateBase64Bytes(bestDataUrl);
        const originalBytes = file.size || optimizedBytes;
        const savingsPercent =
          originalBytes > optimizedBytes
            ? Math.min(99, Math.max(1, Math.round((1 - optimizedBytes / originalBytes) * 100)))
            : 0;

        resolve({
          dataUrl: bestDataUrl,
          width,
          height,
          originalBytes,
          optimizedBytes,
          savingsPercent,
          formatLabel,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1280,
  maxHeight = 960,
  preferPng = false
): Promise<string> {
  const stats = await optimizeImageFileWithStats(
    file,
    maxWidth,
    maxHeight,
    preferPng,
    preferPng ? 80 * 1024 : 68 * 1024
  );
  return stats.dataUrl;
}

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

function SafeImage({ src, alt, className = '' }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-200/80 text-slate-600 p-6 text-center ${className}`}
      >
        <ImageIcon className="w-7 h-7 mb-2 stroke-[1.5]" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export default function App() {
  const [isSeeding, setIsSeeding] = useState(false);

  // PWA Mobile App Installer state & hook
  const [showPWAInstallerModal, setShowPWAInstallerModal] = useState(false);
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, promptInstall } =
    usePWAInstall();

  // Navigation tab (persisted across page reloads)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    try {
      const saved = sessionStorage.getItem('campos_active_tab') as WorkspaceTab | null;
      if (
        saved &&
        ['catalogo', 'leads', 'vendedores', 'produtos', 'seguranca'].includes(saved)
      ) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'catalogo';
  });

  // Company Logo stored in Firestore (/settings/company_logo) + cached locally for instant pre-login render
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('campos_company_logo_url');
      if (cached && cached.trim().length > 0) {
        return cached.trim();
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_COMPANY_LOGO;
  });
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Product Photo Upload Modal state (for existing products)
  const [photoModalProduct, setPhotoModalProduct] = useState<Product | null>(null);
  const [photoUploadMode, setPhotoUploadMode] = useState<'replace_cover' | 'add_gallery'>(
    'replace_cover'
  );
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoCompressionReport, setPhotoCompressionReport] = useState<string | null>(null);
  const productPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Full Product Registration Edit Modal state (for editing any product in the catalog)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdSku, setEditProdSku] = useState('');
  const [editProdManufacturerRef, setEditProdManufacturerRef] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdSegments, setEditProdSegments] = useState<string[]>([]);
  const [editProdDimensions, setEditProdDimensions] = useState('');
  const [editProdMaterial, setEditProdMaterial] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');
  const [editProdInStock, setEditProdInStock] = useState(true);
  const [editProdPrimaryImg, setEditProdPrimaryImg] = useState('');
  const [editProdGalleryImgs, setEditProdGalleryImgs] = useState<string[]>([]);
  const [editProdSaving, setEditProdSaving] = useState(false);
  const [editProdError, setEditProdError] = useState<string | null>(null);
  const [quickSegNameInModal, setQuickSegNameInModal] = useState('');
  const [quickSegSaving, setQuickSegSaving] = useState(false);
  const editProductPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // New Product form photo upload ref
  const newProductPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Firestore synced state (sellers pre-hydrated from cache to avoid auth flicker on reload)
  const [sellers, setSellers] = useState<Seller[]>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_sellers');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [segments, setSegments] = useState<Segment[]>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_segments');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_leads');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [viewsByLead, setViewsByLead] = useState<Record<string, ProductView[]>>({});

  // URL seller tracking parameter (?vendedor=seller_id) with session fallback on reload
  const [activeSellerId, setActiveSellerId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('vendedor') || params.get('seller');
    if (fromUrl) return fromUrl;
    try {
      return (
        sessionStorage.getItem('campos_active_seller_id') ||
        localStorage.getItem('campos_active_seller_id') ||
        ''
      );
    } catch {
      return '';
    }
  });

  // URL segment catalog tracking parameter (?segmento=slug_ou_nome) with session fallback on reload
  const [activeSegmentParam, setActiveSegmentParam] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('segmento') || params.get('segment');
    if (fromUrl !== null) return fromUrl;
    try {
      return sessionStorage.getItem('campos_active_segment') || '';
    } catch {
      return '';
    }
  });

  // Client Link Mode: Activated automatically when opening a link sent to a client (?vendedor=..., ?segmento=..., or ?catalogo=cliente) or persisted across page refresh
  const [isClientMode, setIsClientMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    const hasClientUrlParams =
      params.get('catalogo') === 'cliente' ||
      Boolean(params.get('vendedor')) ||
      Boolean(params.get('seller')) ||
      Boolean(params.get('segmento')) ||
      Boolean(params.get('segment'));
    if (hasClientUrlParams) return true;
    try {
      return (
        sessionStorage.getItem('campos_is_client_mode') === '1' ||
        localStorage.getItem('campos_is_client_mode') === '1'
      );
    } catch {
      return false;
    }
  });

  // Persist whether the client has already entered the catalog ('catalog') so refreshing the page does not close the catalog
  const [clientStep, setClientStep] = useState<'welcome' | 'catalog'>(() => {
    try {
      if (
        sessionStorage.getItem('campos_client_step') === 'catalog' ||
        localStorage.getItem('campos_client_step') === 'catalog' ||
        Boolean(localStorage.getItem('campos_equip_lead_id'))
      ) {
        return 'catalog';
      }
    } catch {
      // ignore storage errors
    }
    return 'welcome';
  });

  // Per-seller selected segment in Vendedores & Links view
  const [sellerSelectedSegment, setSellerSelectedSegment] = useState<
    Record<string, string>
  >({});
  const [copiedCatalogKey, setCopiedCatalogKey] = useState<string | null>(null);

  // Segment Creation / Editing Modal & Form state
  const [showNewSegmentForm, setShowNewSegmentForm] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDesc, setNewSegmentDesc] = useState('');
  const [newSegmentCover, setNewSegmentCover] = useState(IMG_REFRIGERACAO);
  const [segmentFormError, setSegmentFormError] = useState<string | null>(null);
  const newSegmentPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Active client Lead session in Catalog mode
  const [activeLeadId, setActiveLeadId] = useState<string | null>(() => {
    return localStorage.getItem('campos_equip_lead_id');
  });
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [leadFormError, setLeadFormError] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [pendingProductToOpen, setPendingProductToOpen] = useState<Product | null>(null);

  // PDF Table Modal & Catalog Reset Confirmation Modal (Admin Only)
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showResetCatalogConfirmModal, setShowResetCatalogConfirmModal] = useState(false);

  // Session product views before lead identifies themselves
  const [pendingSessionViews, setPendingSessionViews] = useState<string[]>([]);

  // Catalog filters & product detail modal
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      return sessionStorage.getItem('campos_selected_category') || 'Todos';
    } catch {
      return 'Todos';
    }
  });
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);

  // Client Favorites / Wishlist (persisted in localStorage)
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('campos_favorite_product_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string');
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [showFavoritesModal, setShowFavoritesModal] = useState<boolean>(false);

  // Full-Screen Image Lightbox (Zoom & Multi-Photo Expansion)
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    activeIndex: number;
    title: string;
    subtitle?: string;
    product?: Product;
  } | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

  // Legal, LGPD & Internet Compliance Modal state
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<'lgpd' | 'internet' | 'direitos'>('lgpd');
  const [legalCustomNote, setLegalCustomNote] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('campos_legal_custom_note') ||
        'Campos Equipamentos — Atendimento comercial e proteção de dados em conformidade com a Lei nº 13.709/2018 (LGPD) e Lei nº 12.965/2014 (Marco Civil da Internet).'
      );
    } catch {
      return 'Campos Equipamentos — Atendimento comercial e proteção de dados em conformidade com a Lei nº 13.709/2018 (LGPD) e Lei nº 12.965/2014 (Marco Civil da Internet).';
    }
  });
  const [editingLegalNote, setEditingLegalNote] = useState<boolean>(false);
  const [legalNoteDraft, setLegalNoteDraft] = useState<string>('');
  const [clientDataClearedNotice, setClientDataClearedNotice] = useState<boolean>(false);

  // CRM Leads view filters & selected lead drawer
  const [crmSellerFilter, setCrmSellerFilter] = useState<string>('todos');
  const [crmDateFilter, setCrmDateFilter] = useState<LeadDateFilter>('todos');
  const [crmCustomStartDate, setCrmCustomStartDate] = useState<string>('');
  const [crmCustomEndDate, setCrmCustomEndDate] = useState<string>('');
  const [crmSearch, setCrmSearch] = useState<string>('');
  const [inspectedLeadId, setInspectedLeadId] = useState<string | null>(null);
  const [leadsChartMode, setLeadsChartMode] = useState<'barras' | 'area'>('barras');
  const [selectedLeadIdsForPdf, setSelectedLeadIdsForPdf] = useState<string[]>([]);
  const [exportingLeadsPdf, setExportingLeadsPdf] = useState<boolean>(false);

  // Copy link feedback
  const [copiedSellerId, setCopiedSellerId] = useState<string | null>(null);

  // New Seller form state
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerRole, setNewSellerRole] = useState('');
  const [newSellerWhatsapp, setNewSellerWhatsapp] = useState('');
  const [sellerFormError, setSellerFormError] = useState<string | null>(null);
  const [sellerStatusFilter, setSellerStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>(
    'todos'
  );

  // Edit Seller state
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editSellerName, setEditSellerName] = useState('');
  const [editSellerRole, setEditSellerRole] = useState('');
  const [editSellerWhatsapp, setEditSellerWhatsapp] = useState('');
  const [editSellerError, setEditSellerError] = useState<string | null>(null);

  // New Product form state
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdManufacturerRef, setNewProdManufacturerRef] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Refrigeração & Cervejeiras');
  const [newProdSegments, setNewProdSegments] = useState<string[]>([
    'Refrigeração & Cervejeiras',
  ]);
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDimensions, setNewProdDimensions] = useState('');
  const [newProdMaterial, setNewProdMaterial] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrimaryImg, setNewProdPrimaryImg] = useState(IMG_REFRIGERACAO);
  const [newProdExtraImgs, setNewProdExtraImgs] = useState<string[]>([
    IMG_SPEC_INOX,
    IMG_SPEC_NR12,
  ]);
  const [prodFormError, setProdFormError] = useState<string | null>(null);

  // =========================================================================
  // AUTENTICAÇÃO (Supabase Auth: e-mail e senha para a equipe, anônimo para visitantes) & tabela staff
  // =========================================================================
  const [permissions, setPermissions] = useState<Omit<WorkspacePermissions, 'updatedAt'>>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_permissions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_PERMISSIONS_STATE, ...parsed };
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PERMISSIONS_STATE;
  });
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    try {
      const cached = localStorage.getItem('campos_cached_staff');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [currentStaffMember, setCurrentStaffMember] = useState<StaffMember | null>(null);
  const [authUserEmail, setAuthUserEmail] = useState<string>('');
  const [authUid, setAuthUid] = useState<string>(() => auth.currentUser?.uid || '');
  const [authReady, setAuthReady] = useState<boolean>(false);
  const signingInAnonPromiseRef = useRef<Promise<string> | null>(null);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [pendingAdminCallback, setPendingAdminCallback] = useState<(() => void) | null>(null);
  const [permissionSaveToast, setPermissionSaveToast] = useState<string | null>(null);
  const [permissionSaveError, setPermissionSaveError] = useState<string | null>(null);

  // Ensure the visitor or team member is authenticated in Supabase Auth before creating leads or recording views
  const ensureAuthUid = useCallback(async (): Promise<string> => {
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }
    if (signingInAnonPromiseRef.current) {
      return signingInAnonPromiseRef.current;
    }
    const p = signInAnonymously(auth)
      .then((cred) => {
        setAuthUid(cred.user.uid);
        setAuthReady(true);
        return cred.user.uid;
      })
      .finally(() => {
        signingInAnonPromiseRef.current = null;
      });
    signingInAnonPromiseRef.current = p;
    return p;
  }, []);

  // Listen to Supabase Auth state (never sessionStorage/localStorage)
  useEffect(() => {
    // Purge any legacy client-side auth keys if they exist from older versions
    try {
      sessionStorage.removeItem('campos_admin_auth');
      localStorage.removeItem('campos_admin_auth');
      sessionStorage.removeItem('campos_collab_auth_id');
      localStorage.removeItem('campos_collab_auth_id');
      sessionStorage.removeItem('campos_seller_auth_id');
      localStorage.removeItem('campos_seller_auth_id');
      sessionStorage.removeItem('campos_seller_auth_sig');
      localStorage.removeItem('campos_seller_auth_sig');
      localStorage.removeItem('campos_cached_collaborators');
    } catch {
      // ignore storage errors
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdminAuthenticated(false);
        setCurrentStaffMember(null);
        setAuthUserEmail('');
        // Automatically sign in anonymously when not logged in
        try {
          await ensureAuthUid();
        } catch {
          setAuthReady(true);
        }
        return;
      }

      // If logged in anonymously (visitor/client), do not sign out and do not treat as team member
      if (user.isAnonymous) {
        setIsAdminAuthenticated(false);
        setCurrentStaffMember(null);
        setAuthUserEmail('');
        setAuthUid(user.uid);
        setAuthReady(true);
        return;
      }

      // Após uma tentativa de login: mostra o erro no modal se o e-mail não for autorizado
      let cameFromLoginAttempt = false;
      try {
        cameFromLoginAttempt = sessionStorage.getItem('campos_login_attempt') === '1';
        sessionStorage.removeItem('campos_login_attempt');
      } catch {
        // ignore storage errors
      }

      const emailLower = (user.email || '').trim().toLowerCase();
      if (user.emailVerified && emailLower === ADMIN_OWNER_EMAIL.toLowerCase()) {
        setIsAdminAuthenticated(true);
        setCurrentStaffMember(null);
        setAuthUserEmail(emailLower);
        setAuthUid(user.uid);
        setAuthReady(true);
        setAdminLoginError(null);
        setShowAdminLoginModal(false);
        return;
      }

      if (!emailLower) {
        await signOut(auth);
        setIsAdminAuthenticated(false);
        setCurrentStaffMember(null);
        setAuthUserEmail('');
        setAdminLoginError('Seu e-mail não está autorizado. Fale com o administrador.');
        if (cameFromLoginAttempt) setShowAdminLoginModal(true);
        return;
      }

      try {
        const staffDocRef = doc(db, 'staff', emailLower);
        const staffSnap = await getDoc(staffDocRef);
        if (staffSnap.exists()) {
          const data = staffSnap.data() as Omit<StaffMember, 'id'>;
          if (data.active === true) {
            setIsAdminAuthenticated(false);
            setCurrentStaffMember({
              id: staffSnap.id,
              ...data,
            });
            setAuthUserEmail(emailLower);
            setAuthUid(user.uid);
            setAuthReady(true);
            setAdminLoginError(null);
            setShowAdminLoginModal(false);
            return;
          }
        }
        await signOut(auth);
        setIsAdminAuthenticated(false);
        setCurrentStaffMember(null);
        setAuthUserEmail('');
        setAdminLoginError('Seu e-mail não está autorizado. Fale com o administrador.');
        if (cameFromLoginAttempt) setShowAdminLoginModal(true);
      } catch {
        await signOut(auth);
        setIsAdminAuthenticated(false);
        setCurrentStaffMember(null);
        setAuthUserEmail('');
        setAdminLoginError('Seu e-mail não está autorizado. Fale com o administrador.');
        if (cameFromLoginAttempt) setShowAdminLoginModal(true);
      }
    });

    return () => unsubscribeAuth();
  }, [ensureAuthUid]);

  // Keep currentStaffMember synced in real time when /staff/{email} updates
  useEffect(() => {
    if (isAdminAuthenticated || !authUserEmail) return;
    const unsubOwnStaff = onSnapshot(
      doc(db, 'staff', authUserEmail),
      (snap) => {
        if (!snap.exists()) {
          signOut(auth).catch(() => {});
          setCurrentStaffMember(null);
          setAuthUserEmail('');
          setAdminLoginError('Seu e-mail não está autorizado. Fale com o administrador.');
          return;
        }
        const data = snap.data() as Omit<StaffMember, 'id'>;
        if (!data.active) {
          signOut(auth).catch(() => {});
          setCurrentStaffMember(null);
          setAuthUserEmail('');
          setAdminLoginError('Seu e-mail não está autorizado. Fale com o administrador.');
        } else {
          setCurrentStaffMember({
            id: snap.id,
            ...data,
          });
        }
      },
      () => {
        // ignore if signed out
      }
    );
    return () => unsubOwnStaff();
  }, [isAdminAuthenticated, authUserEmail]);

  const authenticatedCollaborator = useMemo(() => {
    if (isAdminAuthenticated || !currentStaffMember) return null;
    if (currentStaffMember.role === 'collaborator' && currentStaffMember.active) {
      return currentStaffMember;
    }
    return null;
  }, [isAdminAuthenticated, currentStaffMember]);

  const authenticatedSeller = useMemo(() => {
    if (isAdminAuthenticated || !currentStaffMember) return null;
    if (currentStaffMember.role === 'seller' && currentStaffMember.active) {
      const matched = sellers.find(
        (s) => s.id === currentStaffMember.sellerId && s.active !== false
      );
      if (matched) return matched;
      return {
        id: currentStaffMember.sellerId || 'vendedor_equipe',
        ownerId: WORKSPACE_OWNER_ID,
        name: currentStaffMember.name,
        roleTitle: currentStaffMember.roleLabel || 'Consultor Comercial',
        whatsapp: '',
        slug: sanitizeId(currentStaffMember.name),
        active: true,
        createdAt: currentStaffMember.createdAt,
        updatedAt: currentStaffMember.updatedAt,
      } as Seller;
    }
    return null;
  }, [isAdminAuthenticated, currentStaffMember, sellers]);

  const isInternalUserAuthenticated =
    isAdminAuthenticated || Boolean(currentStaffMember && currentStaffMember.active);

  // Keep Seller session synced to their own sellerId in Catalog and CRM
  useEffect(() => {
    if (authenticatedSeller && !isAdminAuthenticated && !authenticatedCollaborator) {
      setActiveSellerId(authenticatedSeller.id);
      setCrmSellerFilter(authenticatedSeller.id);
    }
  }, [authenticatedSeller, isAdminAuthenticated, authenticatedCollaborator]);

  // Ensure non-admins cannot stay on the 'seguranca' tab
  useEffect(() => {
    if (!isAdminAuthenticated && activeTab === 'seguranca') {
      setActiveTab('catalogo');
    }
  }, [isAdminAuthenticated, activeTab]);

  // Whether the user opened a client link directly from URL vs previewing from internal panel
  const [isPreviewingClientFromInternal, setIsPreviewingClientFromInternal] = useState<boolean>(
    () => {
      try {
        return sessionStorage.getItem('campos_preview_client_internal') === '1';
      } catch {
        return false;
      }
    }
  );

  // Persist Client Catalog state & navigation across page reloads so refreshing never closes the catalog
  useEffect(() => {
    try {
      sessionStorage.setItem('campos_client_step', clientStep);
      localStorage.setItem('campos_client_step', clientStep);
    } catch {
      // ignore storage errors
    }
  }, [clientStep]);

  useEffect(() => {
    try {
      if (isClientMode) {
        sessionStorage.setItem('campos_is_client_mode', '1');
        localStorage.setItem('campos_is_client_mode', '1');
        const url = new URL(window.location.href);
        if (!url.searchParams.get('catalogo')) {
          url.searchParams.set('catalogo', 'cliente');
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        sessionStorage.removeItem('campos_is_client_mode');
        localStorage.removeItem('campos_is_client_mode');
        const url = new URL(window.location.href);
        if (url.searchParams.get('catalogo') === 'cliente') {
          url.searchParams.delete('catalogo');
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [isClientMode]);

  useEffect(() => {
    try {
      if (isPreviewingClientFromInternal) {
        sessionStorage.setItem('campos_preview_client_internal', '1');
      } else {
        sessionStorage.removeItem('campos_preview_client_internal');
      }
    } catch {
      // ignore storage errors
    }
  }, [isPreviewingClientFromInternal]);

  useEffect(() => {
    try {
      if (activeSellerId) {
        sessionStorage.setItem('campos_active_seller_id', activeSellerId);
        localStorage.setItem('campos_active_seller_id', activeSellerId);
      }
    } catch {
      // ignore storage errors
    }
  }, [activeSellerId]);

  useEffect(() => {
    try {
      sessionStorage.setItem('campos_active_segment', activeSegmentParam);
    } catch {
      // ignore storage errors
    }
  }, [activeSegmentParam]);

  useEffect(() => {
    try {
      sessionStorage.setItem('campos_selected_category', selectedCategory);
    } catch {
      // ignore storage errors
    }
  }, [selectedCategory]);

  useEffect(() => {
    try {
      localStorage.setItem('campos_favorite_product_ids', JSON.stringify(favoriteProductIds));
    } catch {
      // ignore storage errors
    }
  }, [favoriteProductIds]);

  useEffect(() => {
    try {
      sessionStorage.setItem('campos_active_tab', activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  // Effective Seller / Collaborator / Admin capabilities from /staff/{email} or Admin
  const canEditProducts =
    isAdminAuthenticated || Boolean(currentStaffMember?.active && currentStaffMember.canEditProducts);
  const canEditPrices =
    isAdminAuthenticated || Boolean(currentStaffMember?.active && currentStaffMember.canEditPrices);
  const canCreateOrDeleteProducts =
    isAdminAuthenticated ||
    Boolean(currentStaffMember?.active && currentStaffMember.canCreateOrDeleteProducts);
  const canManagePhotos =
    isAdminAuthenticated || Boolean(currentStaffMember?.active && currentStaffMember.canManagePhotos);
  const canManageSegments =
    isAdminAuthenticated ||
    Boolean(currentStaffMember?.active && currentStaffMember.canManageSegments);
  const canManageSellers =
    isAdminAuthenticated ||
    Boolean(currentStaffMember?.active && currentStaffMember.canManageSellers);
  const canDeleteLeads =
    isAdminAuthenticated || Boolean(currentStaffMember?.active && currentStaffMember.canDeleteLeads);
  const canViewPdfTable = isAdminAuthenticated;
  const canChangeLogo =
    isAdminAuthenticated || Boolean(currentStaffMember?.active && currentStaffMember.canChangeLogo);

  // Effective Catalog Visibility Flags (always visible internally, governed by permissions in Client Mode)
  const showProductCodeInCatalog = !isClientMode || permissions.clientShowProductCode;
  const showManufacturerRefInCatalog = !isClientMode || permissions.clientShowManufacturerRef;
  const showPricesInCatalog = !isClientMode || permissions.clientShowPrices;
  const showDimensionsInCatalog = !isClientMode || permissions.clientShowDimensionsAndMaterial;
  const showWhatsappInCatalog = !isClientMode || permissions.clientShowWhatsappButton;

  const openAdminLoginPrompt = (onSuccess?: () => void) => {
    setAdminLoginError(null);
    if (onSuccess) {
      setPendingAdminCallback(() => onSuccess);
    } else {
      setPendingAdminCallback(null);
    }
    setShowAdminLoginModal(true);
  };

  const handleAdminLogout = async () => {
    setIsAdminAuthenticated(false);
    setCurrentStaffMember(null);
    setAuthUserEmail('');
    if (activeTab === 'seguranca') {
      setActiveTab('catalogo');
    }
    try {
      await signOut(auth);
    } catch {
      // Ignore signout error
    }
  };

  // =========================================================================
  // TEAM / STAFF CRUD HANDLERS (/staff/{email}) — ADMIN ONLY
  // =========================================================================
  const handleSaveStaffMember = async (payload: NewStaffMemberPayload) => {
    if (!isAdminAuthenticated) {
      openAdminLoginPrompt();
      return;
    }
    setPermissionSaveError(null);
    const emailLower = payload.email.trim().toLowerCase();
    if (!emailLower || !emailLower.includes('@')) {
      setPermissionSaveError('Informe um e-mail válido.');
      return;
    }

    const existing = staffMembers.find((m) => m.id.toLowerCase() === emailLower);
    const role: 'seller' | 'collaborator' = payload.role === 'seller' ? 'seller' : 'collaborator';
    const sellerId = role === 'seller' ? payload.sellerId.trim() : '';

    try {
      await setDoc(doc(db, 'staff', emailLower), {
        ownerId: WORKSPACE_OWNER_ID,
        name: payload.name.trim().slice(0, VALIDATION_LIMITS.STAFF_NAME_MAX),
        roleLabel: payload.roleLabel.trim().slice(0, VALIDATION_LIMITS.STAFF_ROLE_MAX),
        role,
        sellerId,
        active: existing ? Boolean(existing.active) : true,
        canManagePhotos: Boolean(payload.canManagePhotos),
        canEditProducts: Boolean(payload.canEditProducts),
        canCreateOrDeleteProducts: Boolean(payload.canCreateOrDeleteProducts),
        canManageSegments: Boolean(payload.canManageSegments),
        canEditPrices: Boolean(payload.canEditPrices),
        canManageSellers: Boolean(payload.canManageSellers),
        canDeleteLeads: Boolean(payload.canDeleteLeads),
        canChangeLogo: Boolean(payload.canChangeLogo),
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPermissionSaveToast(
        `Membro da equipe "${payload.name}" (${emailLower}) salvo em /staff/${emailLower}!`
      );
      setTimeout(() => setPermissionSaveToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `staff/${emailLower}`);
    }
  };

  const handleToggleStaffPermission = async (
    member: StaffMember,
    key: StaffPermissionKey
  ) => {
    if (!isAdminAuthenticated) return;
    const emailLower = member.id.trim().toLowerCase();
    const nextVal = !member[key];
    try {
      await setDoc(doc(db, 'staff', emailLower), {
        ownerId: WORKSPACE_OWNER_ID,
        name: member.name,
        roleLabel: member.roleLabel,
        role: member.role === 'seller' ? 'seller' : 'collaborator',
        sellerId: member.role === 'seller' ? member.sellerId : '',
        active: Boolean(member.active),
        canManagePhotos: key === 'canManagePhotos' ? nextVal : Boolean(member.canManagePhotos),
        canEditProducts: key === 'canEditProducts' ? nextVal : Boolean(member.canEditProducts),
        canCreateOrDeleteProducts:
          key === 'canCreateOrDeleteProducts' ? nextVal : Boolean(member.canCreateOrDeleteProducts),
        canManageSegments:
          key === 'canManageSegments' ? nextVal : Boolean(member.canManageSegments),
        canEditPrices: key === 'canEditPrices' ? nextVal : Boolean(member.canEditPrices),
        canManageSellers: key === 'canManageSellers' ? nextVal : Boolean(member.canManageSellers),
        canDeleteLeads: key === 'canDeleteLeads' ? nextVal : Boolean(member.canDeleteLeads),
        canChangeLogo: key === 'canChangeLogo' ? nextVal : Boolean(member.canChangeLogo),
        createdAt: member.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPermissionSaveToast(`Permissões de ${member.name} atualizadas!`);
      setTimeout(() => setPermissionSaveToast(null), 2400);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${emailLower}`);
    }
  };

  const getPresetPermissionsObject = (
    preset: SellerPermissionPreset
  ): Record<StaffPermissionKey, boolean> => {
    if (preset === 'somente_vendas') {
      return {
        canManagePhotos: false,
        canEditProducts: false,
        canCreateOrDeleteProducts: false,
        canManageSegments: false,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      };
    }
    if (preset === 'fotos_desc') {
      return {
        canManagePhotos: true,
        canEditProducts: true,
        canCreateOrDeleteProducts: false,
        canManageSegments: false,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      };
    }
    if (preset === 'catalogo_completo') {
      return {
        canManagePhotos: true,
        canEditProducts: true,
        canCreateOrDeleteProducts: true,
        canManageSegments: true,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      };
    }
    return {
      canManagePhotos: true,
      canEditProducts: true,
      canCreateOrDeleteProducts: true,
      canManageSegments: true,
      canEditPrices: true,
      canManageSellers: true,
      canDeleteLeads: true,
      canChangeLogo: true,
    };
  };

  const handleSetStaffPermissionPreset = async (
    member: StaffMember,
    preset: SellerPermissionPreset
  ) => {
    if (!isAdminAuthenticated) return;
    const emailLower = member.id.trim().toLowerCase();
    const nextPerms = getPresetPermissionsObject(preset);
    try {
      await setDoc(doc(db, 'staff', emailLower), {
        ownerId: WORKSPACE_OWNER_ID,
        name: member.name,
        roleLabel: member.roleLabel,
        role: member.role === 'seller' ? 'seller' : 'collaborator',
        sellerId: member.role === 'seller' ? member.sellerId : '',
        active: Boolean(member.active),
        canManagePhotos: Boolean(nextPerms.canManagePhotos),
        canEditProducts: Boolean(nextPerms.canEditProducts),
        canCreateOrDeleteProducts: Boolean(nextPerms.canCreateOrDeleteProducts),
        canManageSegments: Boolean(nextPerms.canManageSegments),
        canEditPrices: Boolean(nextPerms.canEditPrices),
        canManageSellers: Boolean(nextPerms.canManageSellers),
        canDeleteLeads: Boolean(nextPerms.canDeleteLeads),
        canChangeLogo: Boolean(nextPerms.canChangeLogo),
        createdAt: member.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPermissionSaveToast(`Perfil rápido aplicado a ${member.name}!`);
      setTimeout(() => setPermissionSaveToast(null), 2400);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${emailLower}`);
    }
  };

  const handleToggleStaffActive = async (member: StaffMember) => {
    if (!isAdminAuthenticated) return;
    const emailLower = member.id.trim().toLowerCase();
    try {
      await setDoc(doc(db, 'staff', emailLower), {
        ownerId: WORKSPACE_OWNER_ID,
        name: member.name,
        roleLabel: member.roleLabel,
        role: member.role === 'seller' ? 'seller' : 'collaborator',
        sellerId: member.role === 'seller' ? member.sellerId : '',
        active: !member.active,
        canManagePhotos: Boolean(member.canManagePhotos),
        canEditProducts: Boolean(member.canEditProducts),
        canCreateOrDeleteProducts: Boolean(member.canCreateOrDeleteProducts),
        canManageSegments: Boolean(member.canManageSegments),
        canEditPrices: Boolean(member.canEditPrices),
        canManageSellers: Boolean(member.canManageSellers),
        canDeleteLeads: Boolean(member.canDeleteLeads),
        canChangeLogo: Boolean(member.canChangeLogo),
        createdAt: member.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPermissionSaveToast(
        !member.active
          ? `Acesso de ${member.name} reativado!`
          : `Acesso de ${member.name} desativado.`
      );
      setTimeout(() => setPermissionSaveToast(null), 2400);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${emailLower}`);
    }
  };

  const handleDeleteStaffMember = async (member: StaffMember) => {
    if (!isAdminAuthenticated) return;
    const emailLower = member.id.trim().toLowerCase();
    try {
      await deleteDoc(doc(db, 'staff', emailLower));
      setPermissionSaveToast(`Membro ${member.name} (${emailLower}) removido.`);
      setTimeout(() => setPermissionSaveToast(null), 2400);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${emailLower}`);
    }
  };

  const savePermissionsDocument = async (
    partialState: Partial<Omit<WorkspacePermissions, 'id' | 'updatedAt'>>,
    toastMsg?: string
  ) => {
    const nextState = {
      ...permissions,
      ...partialState,
    };
    setPermissions(nextState);
    try {
      // Overwrite the entire permissions/workspace_config document WITHOUT merge so legacy password fields are removed
      await setDoc(doc(db, 'permissions', 'workspace_config'), {
        ownerId: WORKSPACE_OWNER_ID,
        clientShowPrices: Boolean(nextState.clientShowPrices),
        clientShowProductCode: Boolean(nextState.clientShowProductCode),
        clientShowManufacturerRef: Boolean(nextState.clientShowManufacturerRef),
        clientShowDimensionsAndMaterial: Boolean(nextState.clientShowDimensionsAndMaterial),
        clientShowPhotosCount: Boolean(nextState.clientShowPhotosCount),
        clientHideOutOfStock: Boolean(nextState.clientHideOutOfStock),
        clientShowWhatsappButton: Boolean(nextState.clientShowWhatsappButton),
        clientRequireIdentification: Boolean(nextState.clientRequireIdentification),
        sellerCanEditProducts: Boolean(nextState.sellerCanEditProducts),
        sellerCanEditPrices: Boolean(nextState.sellerCanEditPrices),
        sellerCanCreateOrDeleteProducts: Boolean(nextState.sellerCanCreateOrDeleteProducts),
        sellerCanManagePhotos: Boolean(nextState.sellerCanManagePhotos),
        sellerCanManageSegments: Boolean(nextState.sellerCanManageSegments),
        sellerCanManageSellers: Boolean(nextState.sellerCanManageSellers),
        sellerCanDeleteLeads: Boolean(nextState.sellerCanDeleteLeads),
        sellerCanViewPdfTable: Boolean(nextState.sellerCanViewPdfTable),
        sellerCanChangeLogo: Boolean(nextState.sellerCanChangeLogo),
        updatedAt: serverTimestamp(),
      });
      if (toastMsg) {
        setPermissionSaveToast(toastMsg);
        setTimeout(() => setPermissionSaveToast(null), 2600);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'permissions/workspace_config');
    }
  };

  const handleTogglePermissionKey = async (
    key: keyof Omit<WorkspacePermissions, 'id' | 'ownerId' | 'updatedAt'>
  ) => {
    if (!isAdminAuthenticated) {
      openAdminLoginPrompt();
      return;
    }
    const nextVal = !permissions[key];
    await savePermissionsDocument({ [key]: nextVal }, 'Permissão atualizada em tempo real!');
  };

  // 1. Admin-only initialization & explicit catalog reset (never runs for visitors or sellers, never auto-deletes data on open)
  const syncCamposCatalogToFirestore = useCallback(
    async (forceReset = false) => {
      const currentUser = auth.currentUser;
      const isVerifiedAdmin =
        Boolean(currentUser?.emailVerified) &&
        (currentUser?.email || '').trim().toLowerCase() === ADMIN_OWNER_EMAIL.toLowerCase();
      if (!isAdminAuthenticated || !isVerifiedAdmin) {
        return;
      }

      setIsSeeding(true);
      try {
        const logoRef = doc(db, 'settings', 'company_logo');
        const logoSnap = await getDoc(logoRef);
        if (!logoSnap.exists()) {
          await setDoc(logoRef, {
            ownerId: WORKSPACE_OWNER_ID,
            logoUrl: DEFAULT_COMPANY_LOGO,
            updatedAt: serverTimestamp(),
          });
        }

        // Ensure initial permissions document exists in Firestore with ONLY the 19 allowed fields
        const permDocRef = doc(db, 'permissions', 'workspace_config');
        const permDocSnap = await getDoc(permDocRef);
        if (
          !permDocSnap.exists() ||
          'adminPasswordHash' in permDocSnap.data() ||
          'adminLogin' in permDocSnap.data() ||
          'isCustomPasswordSet' in permDocSnap.data()
        ) {
          const existingData = permDocSnap.exists() ? permDocSnap.data() : {};
          await setDoc(permDocRef, {
            ownerId: WORKSPACE_OWNER_ID,
            clientShowPrices:
              typeof existingData.clientShowPrices === 'boolean'
                ? existingData.clientShowPrices
                : DEFAULT_PERMISSIONS_STATE.clientShowPrices,
            clientShowProductCode:
              typeof existingData.clientShowProductCode === 'boolean'
                ? existingData.clientShowProductCode
                : DEFAULT_PERMISSIONS_STATE.clientShowProductCode,
            clientShowManufacturerRef:
              typeof existingData.clientShowManufacturerRef === 'boolean'
                ? existingData.clientShowManufacturerRef
                : DEFAULT_PERMISSIONS_STATE.clientShowManufacturerRef,
            clientShowDimensionsAndMaterial:
              typeof existingData.clientShowDimensionsAndMaterial === 'boolean'
                ? existingData.clientShowDimensionsAndMaterial
                : DEFAULT_PERMISSIONS_STATE.clientShowDimensionsAndMaterial,
            clientShowPhotosCount:
              typeof existingData.clientShowPhotosCount === 'boolean'
                ? existingData.clientShowPhotosCount
                : DEFAULT_PERMISSIONS_STATE.clientShowPhotosCount,
            clientHideOutOfStock:
              typeof existingData.clientHideOutOfStock === 'boolean'
                ? existingData.clientHideOutOfStock
                : DEFAULT_PERMISSIONS_STATE.clientHideOutOfStock,
            clientShowWhatsappButton:
              typeof existingData.clientShowWhatsappButton === 'boolean'
                ? existingData.clientShowWhatsappButton
                : DEFAULT_PERMISSIONS_STATE.clientShowWhatsappButton,
            clientRequireIdentification:
              typeof existingData.clientRequireIdentification === 'boolean'
                ? existingData.clientRequireIdentification
                : DEFAULT_PERMISSIONS_STATE.clientRequireIdentification,
            sellerCanEditProducts:
              typeof existingData.sellerCanEditProducts === 'boolean'
                ? existingData.sellerCanEditProducts
                : DEFAULT_PERMISSIONS_STATE.sellerCanEditProducts,
            sellerCanEditPrices:
              typeof existingData.sellerCanEditPrices === 'boolean'
                ? existingData.sellerCanEditPrices
                : DEFAULT_PERMISSIONS_STATE.sellerCanEditPrices,
            sellerCanCreateOrDeleteProducts:
              typeof existingData.sellerCanCreateOrDeleteProducts === 'boolean'
                ? existingData.sellerCanCreateOrDeleteProducts
                : DEFAULT_PERMISSIONS_STATE.sellerCanCreateOrDeleteProducts,
            sellerCanManagePhotos:
              typeof existingData.sellerCanManagePhotos === 'boolean'
                ? existingData.sellerCanManagePhotos
                : DEFAULT_PERMISSIONS_STATE.sellerCanManagePhotos,
            sellerCanManageSegments:
              typeof existingData.sellerCanManageSegments === 'boolean'
                ? existingData.sellerCanManageSegments
                : DEFAULT_PERMISSIONS_STATE.sellerCanManageSegments,
            sellerCanManageSellers:
              typeof existingData.sellerCanManageSellers === 'boolean'
                ? existingData.sellerCanManageSellers
                : DEFAULT_PERMISSIONS_STATE.sellerCanManageSellers,
            sellerCanDeleteLeads:
              typeof existingData.sellerCanDeleteLeads === 'boolean'
                ? existingData.sellerCanDeleteLeads
                : DEFAULT_PERMISSIONS_STATE.sellerCanDeleteLeads,
            sellerCanViewPdfTable:
              typeof existingData.sellerCanViewPdfTable === 'boolean'
                ? existingData.sellerCanViewPdfTable
                : DEFAULT_PERMISSIONS_STATE.sellerCanViewPdfTable,
            sellerCanChangeLogo:
              typeof existingData.sellerCanChangeLogo === 'boolean'
                ? existingData.sellerCanChangeLogo
                : DEFAULT_PERMISSIONS_STATE.sellerCanChangeLogo,
            updatedAt: serverTimestamp(),
          });
        }

        // Seed initial segments ONLY if empty or when Admin explicitly confirms reset
        const segmentsQ = query(
          collection(db, 'segments'),
          where('ownerId', '==', WORKSPACE_OWNER_ID)
        );
        const existingSegmentsSnap = await getDocs(segmentsQ);
        if (existingSegmentsSnap.empty || forceReset) {
          for (const seg of INITIAL_SEGMENTS) {
            await setDoc(doc(db, 'segments', seg.id), {
              ownerId: WORKSPACE_OWNER_ID,
              name: seg.name.slice(0, VALIDATION_LIMITS.SEGMENT_NAME_MAX),
              slug: seg.slug.slice(0, VALIDATION_LIMITS.SEGMENT_SLUG_MAX),
              description: seg.description.slice(0, VALIDATION_LIMITS.SEGMENT_DESC_MAX),
              coverImage: seg.coverImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const productsQ = query(
          collection(db, 'products'),
          where('ownerId', '==', WORKSPACE_OWNER_ID)
        );
        const existingProductsSnap = await getDocs(productsQ);

        if (!existingProductsSnap.empty && !forceReset) {
          setIsSeeding(false);
          return;
        }

        if (forceReset) {
          for (const d of existingProductsSnap.docs) {
            await deleteDoc(doc(db, 'products', d.id));
          }
        }

        // Seed initial products ONLY when catalog is empty or when Admin explicitly resets
        for (const p of INITIAL_PRODUCTS) {
          await setDoc(doc(db, 'products', p.id), {
            ownerId: WORKSPACE_OWNER_ID,
            sku: p.sku.slice(0, VALIDATION_LIMITS.PRODUCT_SKU_MAX),
            name: p.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
            category: p.category.slice(0, VALIDATION_LIMITS.PRODUCT_CATEGORY_MAX),
            price: p.price,
            description: p.description.slice(0, VALIDATION_LIMITS.PRODUCT_DESC_MAX),
            dimensions: p.dimensions.slice(0, VALIDATION_LIMITS.PRODUCT_DIM_MAX),
            material: p.material.slice(0, VALIDATION_LIMITS.PRODUCT_MAT_MAX),
            primaryImage: p.primaryImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
            galleryImages: p.galleryImages.slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX),
            inStock: p.inStock,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'sync_campos_catalog');
      } finally {
        setIsSeeding(false);
      }
    },
    [isAdminAuthenticated]
  );

  // Attach real-time listener for /staff ONLY when logged in as Admin
  useEffect(() => {
    if (!isAdminAuthenticated) {
      setStaffMembers([]);
      return;
    }
    const staffQ = query(
      collection(db, 'staff'),
      where('ownerId', '==', WORKSPACE_OWNER_ID)
    );
    const unsubStaff = onSnapshot(
      staffQ,
      (snap) => {
        const list: StaffMember[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffMember, 'id'>),
        }));
        setStaffMembers(list);
        try {
          localStorage.setItem('campos_cached_staff', JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
    );
    return () => unsubStaff();
  }, [isAdminAuthenticated]);

  // 2. Attach real-time Firestore listeners for public catalog collections immediately on mount
  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'company_logo'),
      (logoDoc) => {
        if (logoDoc.exists() && logoDoc.data().logoUrl) {
          const remoteLogo = String(logoDoc.data().logoUrl).trim();
          if (remoteLogo) {
            let cachedCustom: string | null = null;
            try {
              const c = localStorage.getItem('campos_company_logo_url');
              if (c && c.trim() && c.trim() !== DEFAULT_COMPANY_LOGO) {
                cachedCustom = c.trim();
              }
            } catch {
              // ignore
            }
            if (remoteLogo === DEFAULT_COMPANY_LOGO && cachedCustom) {
              setCompanyLogoUrl(cachedCustom);
              return;
            }
            setCompanyLogoUrl(remoteLogo);
            try {
              localStorage.setItem('campos_company_logo_url', remoteLogo);
            } catch {
              // ignore storage errors
            }
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/company_logo')
    );

    const unsubPermissions = onSnapshot(
      doc(db, 'permissions', 'workspace_config'),
      (permDoc) => {
        if (permDoc.exists()) {
          const data = permDoc.data() as Omit<WorkspacePermissions, 'id'>;
          const nextPerms = {
            ...DEFAULT_PERMISSIONS_STATE,
            clientShowPrices:
              typeof data.clientShowPrices === 'boolean'
                ? data.clientShowPrices
                : DEFAULT_PERMISSIONS_STATE.clientShowPrices,
            clientShowProductCode:
              typeof data.clientShowProductCode === 'boolean'
                ? data.clientShowProductCode
                : DEFAULT_PERMISSIONS_STATE.clientShowProductCode,
            clientShowManufacturerRef:
              typeof data.clientShowManufacturerRef === 'boolean'
                ? data.clientShowManufacturerRef
                : DEFAULT_PERMISSIONS_STATE.clientShowManufacturerRef,
            clientShowDimensionsAndMaterial:
              typeof data.clientShowDimensionsAndMaterial === 'boolean'
                ? data.clientShowDimensionsAndMaterial
                : DEFAULT_PERMISSIONS_STATE.clientShowDimensionsAndMaterial,
            clientShowPhotosCount:
              typeof data.clientShowPhotosCount === 'boolean'
                ? data.clientShowPhotosCount
                : DEFAULT_PERMISSIONS_STATE.clientShowPhotosCount,
            clientHideOutOfStock:
              typeof data.clientHideOutOfStock === 'boolean'
                ? data.clientHideOutOfStock
                : DEFAULT_PERMISSIONS_STATE.clientHideOutOfStock,
            clientShowWhatsappButton:
              typeof data.clientShowWhatsappButton === 'boolean'
                ? data.clientShowWhatsappButton
                : DEFAULT_PERMISSIONS_STATE.clientShowWhatsappButton,
            clientRequireIdentification:
              typeof data.clientRequireIdentification === 'boolean'
                ? data.clientRequireIdentification
                : DEFAULT_PERMISSIONS_STATE.clientRequireIdentification,
            sellerCanEditProducts:
              typeof data.sellerCanEditProducts === 'boolean'
                ? data.sellerCanEditProducts
                : DEFAULT_PERMISSIONS_STATE.sellerCanEditProducts,
            sellerCanEditPrices:
              typeof data.sellerCanEditPrices === 'boolean'
                ? data.sellerCanEditPrices
                : DEFAULT_PERMISSIONS_STATE.sellerCanEditPrices,
            sellerCanCreateOrDeleteProducts:
              typeof data.sellerCanCreateOrDeleteProducts === 'boolean'
                ? data.sellerCanCreateOrDeleteProducts
                : DEFAULT_PERMISSIONS_STATE.sellerCanCreateOrDeleteProducts,
            sellerCanManagePhotos:
              typeof data.sellerCanManagePhotos === 'boolean'
                ? data.sellerCanManagePhotos
                : DEFAULT_PERMISSIONS_STATE.sellerCanManagePhotos,
            sellerCanManageSegments:
              typeof data.sellerCanManageSegments === 'boolean'
                ? data.sellerCanManageSegments
                : DEFAULT_PERMISSIONS_STATE.sellerCanManageSegments,
            sellerCanManageSellers:
              typeof data.sellerCanManageSellers === 'boolean'
                ? data.sellerCanManageSellers
                : DEFAULT_PERMISSIONS_STATE.sellerCanManageSellers,
            sellerCanDeleteLeads:
              typeof data.sellerCanDeleteLeads === 'boolean'
                ? data.sellerCanDeleteLeads
                : DEFAULT_PERMISSIONS_STATE.sellerCanDeleteLeads,
            sellerCanViewPdfTable:
              typeof data.sellerCanViewPdfTable === 'boolean'
                ? data.sellerCanViewPdfTable
                : DEFAULT_PERMISSIONS_STATE.sellerCanViewPdfTable,
            sellerCanChangeLogo:
              typeof data.sellerCanChangeLogo === 'boolean'
                ? data.sellerCanChangeLogo
                : DEFAULT_PERMISSIONS_STATE.sellerCanChangeLogo,
            id: permDoc.id,
          };
          setPermissions(nextPerms);
          try {
            localStorage.setItem('campos_cached_permissions', JSON.stringify(nextPerms));
          } catch {
            // ignore storage errors
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'permissions/workspace_config')
    );

    const sellersQ = query(
      collection(db, 'sellers'),
      where('ownerId', '==', WORKSPACE_OWNER_ID)
    );
    const unsubSellers = onSnapshot(
      sellersQ,
      (snap) => {
        const list: Seller[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Seller, 'id'>),
        }));
        setSellers(list);
        try {
          localStorage.setItem('campos_cached_sellers', JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sellers')
    );

    const segmentsQ = query(
      collection(db, 'segments'),
      where('ownerId', '==', WORKSPACE_OWNER_ID)
    );
    const unsubSegments = onSnapshot(
      segmentsQ,
      (snap) => {
        const list: Segment[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Segment, 'id'>),
        }));
        setSegments(list);
        try {
          localStorage.setItem('campos_cached_segments', JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'segments')
    );

    const productsQ = query(
      collection(db, 'products'),
      where('ownerId', '==', WORKSPACE_OWNER_ID)
    );
    const unsubProducts = onSnapshot(
      productsQ,
      (snap) => {
        const list: Product[] = snap.docs.map((d) => {
          const data = d.data() as Omit<Product, 'id'>;
          let primaryImage = data.primaryImage || '';
          let galleryImages = Array.isArray(data.galleryImages) ? data.galleryImages : [];

          if (isGenericPlaceholderImage(primaryImage)) {
            const generated = buildProductGalleryFromMetadata({
              name: data.name,
              sku: data.sku,
              dimensions: data.dimensions,
              material: data.material,
              category: data.category,
            });
            primaryImage = generated.primaryImage;
            galleryImages = generated.galleryImages;
          } else if (galleryImages.length === 0) {
            galleryImages = [primaryImage];
          }

          return {
            id: d.id,
            ...data,
            primaryImage,
            galleryImages,
          };
        });
        setProducts(list);
        try {
          localStorage.setItem('campos_cached_products', JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    return () => {
      unsubSettings();
      unsubPermissions();
      unsubSellers();
      unsubSegments();
      unsubProducts();
    };
  }, []);

  // 2B. Role-scoped listener for "leads" collection:
  // - Visitor (client mode or anonymous): where('clientUid', '==', auth.currentUser.uid)
  // - Logged-in Seller: where('sellerId', '==', currentStaffMember.sellerId)
  // - Admin or Collaborator: all leads
  useEffect(() => {
    const currentUid = auth.currentUser?.uid || authUid;
    if (!authReady || !currentUid) {
      return;
    }

    let leadsQ;
    if (isClientMode || (!isAdminAuthenticated && !currentStaffMember?.active)) {
      leadsQ = query(collection(db, 'leads'), where('clientUid', '==', currentUid));
    } else if (currentStaffMember?.active && currentStaffMember.role === 'seller') {
      if (!currentStaffMember.sellerId) {
        setLeads([]);
        return;
      }
      leadsQ = query(
        collection(db, 'leads'),
        where('sellerId', '==', currentStaffMember.sellerId)
      );
    } else {
      // Admin or Collaborator can list all leads
      leadsQ = query(collection(db, 'leads'));
    }

    const unsubLeads = onSnapshot(
      leadsQ,
      (snap) => {
        const list: Lead[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Lead, 'id'>),
        }));
        list.sort((a, b) => {
          const tA = a.updatedAt?.toMillis?.() || 0;
          const tB = b.updatedAt?.toMillis?.() || 0;
          return tB - tA;
        });
        setLeads(list);
        try {
          localStorage.setItem('campos_cached_leads', JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'leads')
    );

    return () => {
      unsubLeads();
    };
  }, [authReady, authUid, isClientMode, isAdminAuthenticated, currentStaffMember]);

  // Keep selectedProduct and photoModalProduct synced with real-time Firestore product updates
  useEffect(() => {
    if (selectedProduct) {
      const updated = products.find((p) => p.id === selectedProduct.id);
      if (updated) setSelectedProduct(updated);
    }
    if (photoModalProduct) {
      const updated = products.find((p) => p.id === photoModalProduct.id);
      if (updated) setPhotoModalProduct(updated);
    }
  }, [products, selectedProduct, photoModalProduct]);

  // 3. Listen to views subcollections ONLY for leads that the current user is allowed to see and currently inspecting/active
  useEffect(() => {
    const currentUid = auth.currentUser?.uid || authUid;
    if (!authReady || !currentUid || leads.length === 0) {
      setViewsByLead({});
      return;
    }

    const allowedLeads = leads.filter((lead) => {
      if (isClientMode || (!isAdminAuthenticated && !currentStaffMember?.active)) {
        return lead.clientUid === currentUid;
      }
      // In internal panel, only attach views listeners when on the 'leads' tab and for the inspected/selected leads to conserve Firestore reads
      if (activeTab !== 'leads') {
        return lead.id === activeLeadId && lead.clientUid === currentUid;
      }
      const isInspectedOrSelected =
        lead.id === inspectedLeadId ||
        (!inspectedLeadId && lead.id === leads[0]?.id) ||
        selectedLeadIdsForPdf.includes(lead.id);
      if (!isInspectedOrSelected) {
        return false;
      }
      if (currentStaffMember?.active && currentStaffMember.role === 'seller') {
        return lead.sellerId === currentStaffMember.sellerId;
      }
      return true;
    });

    if (allowedLeads.length === 0) {
      return;
    }

    const unsubs = allowedLeads.map((lead) => {
      const viewsRef = collection(db, 'leads', lead.id, 'views');
      return onSnapshot(
        viewsRef,
        (snap) => {
          const vList: ProductView[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ProductView, 'id'>),
          }));
          vList.sort((a, b) => {
            const tA = a.updatedAt?.toMillis?.() || 0;
            const tB = b.updatedAt?.toMillis?.() || 0;
            return tB - tA;
          });
          setViewsByLead((prev) => ({
            ...prev,
            [lead.id]: vList,
          }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `leads/${lead.id}/views`)
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    leads,
    authReady,
    authUid,
    isClientMode,
    isAdminAuthenticated,
    currentStaffMember,
    activeTab,
    activeLeadId,
    inspectedLeadId,
    selectedLeadIdsForPdf,
  ]);

  // Save Company Logo to Firestore
  const saveCompanyLogoToDatabase = async (newLogoUrl: string) => {
    const trimmed = newLogoUrl.trim();
    if (!trimmed) {
      setLogoError('Selecione uma imagem ou informe uma URL válida.');
      return;
    }
    if (trimmed.length > VALIDATION_LIMITS.LOGO_URL_MAX) {
      setLogoError('A imagem selecionada excede o tamanho máximo permitido.');
      return;
    }
    setLogoSaving(true);
    setLogoError(null);
    try {
      setCompanyLogoUrl(trimmed);
      try {
        localStorage.setItem('campos_company_logo_url', trimmed);
      } catch {
        // ignore storage errors
      }
      await setDoc(doc(db, 'settings', 'company_logo'), {
        ownerId: WORKSPACE_OWNER_ID,
        logoUrl: trimmed,
        updatedAt: serverTimestamp(),
      });
      setShowLogoModal(false);
      setLogoUrlInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/company_logo');
    } finally {
      setLogoSaving(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoSaving(true);
    setLogoError(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 640, 240, true);
      await saveCompanyLogoToDatabase(dataUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Erro ao processar logomarca.');
      setLogoSaving(false);
    } finally {
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  // Product Photo Management Handlers (Upload from device, URL, Set Cover, Remove from Gallery)
  const openProductPhotoModal = (product: Product, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!canManagePhotos) {
      openAdminLoginPrompt(() => {
        setEditingProduct(null);
        setPhotoModalProduct(product);
        setPhotoUploadMode('replace_cover');
        setPhotoUrlInput('');
        setPhotoError(null);
        setPhotoCompressionReport(null);
      });
      return;
    }
    setEditingProduct(null);
    setPhotoModalProduct(product);
    setPhotoUploadMode('replace_cover');
    setPhotoUrlInput('');
    setPhotoError(null);
    setPhotoCompressionReport(null);
  };

  // Batch generate & save product-specific photos for all products based on Name, Manufacturer & Reference
  const handleSyncAllProductPhotosFromMetadata = async () => {
    if (!canManagePhotos && !canEditProducts) {
      openAdminLoginPrompt();
      return;
    }
    setIsSeeding(true);
    try {
      for (const prod of displayProducts) {
        const generated = buildProductGalleryFromMetadata({
          name: prod.name,
          sku: prod.sku,
          dimensions: prod.dimensions,
          material: prod.material,
          category: prod.category,
        });
        await setDoc(doc(db, 'products', prod.id), {
          ownerId: WORKSPACE_OWNER_ID,
          sku: prod.sku.slice(0, VALIDATION_LIMITS.PRODUCT_SKU_MAX),
          name: prod.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
          category: prod.category.slice(0, VALIDATION_LIMITS.PRODUCT_CATEGORY_MAX),
          price: prod.price,
          description: prod.description.slice(0, VALIDATION_LIMITS.PRODUCT_DESC_MAX),
          dimensions: prod.dimensions.slice(0, VALIDATION_LIMITS.PRODUCT_DIM_MAX),
          material: prod.material.slice(0, VALIDATION_LIMITS.PRODUCT_MAT_MAX),
          primaryImage: generated.primaryImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
          galleryImages: generated.galleryImages.slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX),
          inStock: prod.inStock !== false,
          createdAt: prod.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/batch_photos');
    } finally {
      setIsSeeding(false);
    }
  };

  const applyPhotoToProduct = async (product: Product, newImageSrc: string) => {
    if (!canManagePhotos) return;
    const trimmed = newImageSrc.trim();
    if (!trimmed) return;
    if (trimmed.length > VALIDATION_LIMITS.PRODUCT_IMG_MAX) {
      setPhotoError('A imagem selecionada é muito grande.');
      return;
    }

    setPhotoSaving(true);
    setPhotoError(null);
    try {
      let nextPrimary = product.primaryImage;
      let nextGallery = [...(product.galleryImages || [])];

      if (photoUploadMode === 'replace_cover') {
        nextPrimary = trimmed;
        // Put the new cover first in the gallery
        const filtered = nextGallery.filter((img) => img !== trimmed);
        nextGallery = [trimmed, ...filtered].slice(
          0,
          VALIDATION_LIMITS.PRODUCT_GALLERY_MAX
        );
      } else {
        // Add to gallery
        if (!nextGallery.includes(trimmed)) {
          if (nextGallery.length >= VALIDATION_LIMITS.PRODUCT_GALLERY_MAX) {
            nextGallery = [
              ...nextGallery.slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX - 1),
              trimmed,
            ];
          } else {
            nextGallery.push(trimmed);
          }
        }
      }

      await setDoc(doc(db, 'products', product.id), {
        ownerId: WORKSPACE_OWNER_ID,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description,
        dimensions: product.dimensions,
        material: product.material,
        primaryImage: nextPrimary,
        galleryImages: nextGallery,
        inStock: product.inStock,
        createdAt: product.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPhotoUrlInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleProductPhotoFilesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!canManagePhotos) return;
    const files = e.target.files;
    if (!files || files.length === 0 || !photoModalProduct) return;

    setPhotoSaving(true);
    setPhotoError(null);
    setPhotoCompressionReport(null);
    try {
      const uploadedUrls: string[] = [];
      let totalOrigBytes = 0;
      let totalOptBytes = 0;
      let lastStats: ImageOptimizationStats | null = null;

      for (let i = 0; i < files.length; i++) {
        const stats = await optimizeImageFileWithStats(
          files[i],
          1280,
          960,
          false,
          68 * 1024
        );
        uploadedUrls.push(stats.dataUrl);
        totalOrigBytes += stats.originalBytes;
        totalOptBytes += stats.optimizedBytes;
        lastStats = stats;
      }

      if (lastStats) {
        const totalSavings =
          totalOrigBytes > totalOptBytes
            ? Math.min(99, Math.max(1, Math.round((1 - totalOptBytes / totalOrigBytes) * 100)))
            : 0;
        setPhotoCompressionReport(
          `Foto otimizada em ${lastStats.formatLabel} (${lastStats.width}×${lastStats.height}px): de ${formatKilobytes(
            totalOrigBytes
          )} para apenas ${formatKilobytes(totalOptBytes)}${
            totalSavings > 0 ? ` (${totalSavings}% mais leve sem perda de nitidez)` : ''
          }!`
        );
      }

      let nextPrimary = photoModalProduct.primaryImage;
      let nextGallery = [...(photoModalProduct.galleryImages || [])];

      if (photoUploadMode === 'replace_cover') {
        nextPrimary = uploadedUrls[0];
        const remaining = nextGallery.filter((img) => !uploadedUrls.includes(img));
        nextGallery = [...uploadedUrls, ...remaining].slice(
          0,
          VALIDATION_LIMITS.PRODUCT_GALLERY_MAX
        );
      } else {
        for (const u of uploadedUrls) {
          if (!nextGallery.includes(u)) {
            nextGallery.push(u);
          }
        }
        nextGallery = nextGallery.slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX);
      }

      await setDoc(doc(db, 'products', photoModalProduct.id), {
        ownerId: WORKSPACE_OWNER_ID,
        sku: photoModalProduct.sku,
        name: photoModalProduct.name,
        category: photoModalProduct.category,
        price: photoModalProduct.price,
        description: photoModalProduct.description,
        dimensions: photoModalProduct.dimensions,
        material: photoModalProduct.material,
        primaryImage: nextPrimary,
        galleryImages: nextGallery,
        inStock: photoModalProduct.inStock,
        createdAt: photoModalProduct.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Erro ao processar foto do produto.'
      );
    } finally {
      setPhotoSaving(false);
      if (productPhotoInputRef.current) {
        productPhotoInputRef.current.value = '';
      }
    }
  };

  const handleSetGalleryImageAsCover = async (product: Product, imgUrl: string) => {
    if (!canManagePhotos) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const reordered = [
        imgUrl,
        ...product.galleryImages.filter((u) => u !== imgUrl),
      ].slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX);

      await updateDoc(doc(db, 'products', product.id), {
        primaryImage: imgUrl,
        galleryImages: reordered,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleRemoveGalleryImage = async (product: Product, imgUrl: string) => {
    if (!canManagePhotos) return;
    if (product.galleryImages.length <= 1) {
      setPhotoError('O produto precisa manter pelo menos 1 imagem na galeria.');
      return;
    }
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const remaining = product.galleryImages.filter((u) => u !== imgUrl);
      const nextPrimary =
        product.primaryImage === imgUrl ? remaining[0] : product.primaryImage;

      await updateDoc(doc(db, 'products', product.id), {
        primaryImage: nextPrimary,
        galleryImages: remaining,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setPhotoSaving(false);
    }
  };

  // Upload photo inside New Product Form
  const handleNewProductPhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const uploaded: string[] = [];
      let totalOrig = 0;
      let totalOpt = 0;
      let lastStats: ImageOptimizationStats | null = null;
      for (let i = 0; i < files.length; i++) {
        const stats = await optimizeImageFileWithStats(
          files[i],
          1280,
          960,
          false,
          68 * 1024
        );
        uploaded.push(stats.dataUrl);
        totalOrig += stats.originalBytes;
        totalOpt += stats.optimizedBytes;
        lastStats = stats;
      }
      setNewProdPrimaryImg(uploaded[0]);
      if (uploaded.length > 1) {
        setNewProdExtraImgs(uploaded.slice(1, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX));
      }
      if (lastStats) {
        setPhotoCompressionReport(
          `Foto otimizada em ${lastStats.formatLabel} (${lastStats.width}×${lastStats.height}px): de ${formatKilobytes(
            totalOrig
          )} para ${formatKilobytes(totalOpt)}!`
        );
      }
    } catch (err) {
      setProdFormError(
        err instanceof Error ? err.message : 'Erro ao carregar foto do produto.'
      );
    } finally {
      if (newProductPhotoInputRef.current) {
        newProductPhotoInputRef.current.value = '';
      }
    }
  };

  // Active sellers list
  const activeSellers = useMemo(() => {
    return sellers.filter((s) => s.active !== false);
  }, [sellers]);

  const filteredSellers = useMemo(() => {
    // If logged in strictly as a Seller (and without Admin/Collaborator seller management rights), show only their own Seller profile
    if (authenticatedSeller && !isAdminAuthenticated && !canManageSellers) {
      return [authenticatedSeller];
    }
    if (sellerStatusFilter === 'ativos') {
      return sellers.filter((s) => s.active !== false);
    }
    if (sellerStatusFilter === 'inativos') {
      return sellers.filter((s) => s.active === false);
    }
    return sellers;
  }, [sellers, sellerStatusFilter, authenticatedSeller, isAdminAuthenticated, canManageSellers]);

  // Ensure activeSellerId resolves to a valid active seller (or the logged-in seller when in internal panel)
  const currentSeller = useMemo(() => {
    if (!isClientMode && authenticatedSeller && !isAdminAuthenticated && !authenticatedCollaborator) {
      return authenticatedSeller;
    }
    if (sellers.length === 0) {
      return {
        id: 'atendimento_geral',
        ownerId: WORKSPACE_OWNER_ID,
        name: 'Atendimento Comercial',
        roleTitle: 'Equipe de Vendas',
        whatsapp: 'Cadastre seus vendedores na aba Vendedores & Links',
        slug: 'atendimento-geral',
        active: true,
      } as Seller;
    }
    const found = sellers.find(
      (s) => s.id === activeSellerId || s.slug === activeSellerId
    );
    if (found && found.active !== false) {
      return found;
    }
    return activeSellers[0] || found || sellers[0];
  }, [
    isClientMode,
    authenticatedSeller,
    isAdminAuthenticated,
    authenticatedCollaborator,
    sellers,
    activeSellers,
    activeSellerId,
  ]);

  // Resolve current active lead if it exists in Firestore and belongs to the current visitor UID
  const currentActiveLead = useMemo(() => {
    const currentUid = auth.currentUser?.uid || authUid;
    if (!currentUid) return null;
    if (activeLeadId) {
      const matched = leads.find((l) => l.id === activeLeadId && l.clientUid === currentUid);
      if (matched) return matched;
    }
    if (isClientMode) {
      return leads.find((l) => l.clientUid === currentUid) || null;
    }
    return null;
  }, [leads, activeLeadId, authUid, isClientMode]);

  // Auto-select first lead in CRM inspector if none selected
  useEffect(() => {
    if (!inspectedLeadId && leads.length > 0) {
      setInspectedLeadId(leads[0].id);
    }
  }, [leads, inspectedLeadId]);

  // Switch active seller link & update browser URL query param without reload
  const selectSellerLink = (seller: Seller) => {
    setActiveSellerId(seller.id);
    const url = new URL(window.location.href);
    url.searchParams.set('vendedor', seller.id);
    window.history.replaceState({}, '', url.toString());
  };

  // Switch active Segment Catalog & update browser URL query param (?segmento=...)
  const selectSegmentCatalog = (segmentSlugOrEmpty: string) => {
    setActiveSegmentParam(segmentSlugOrEmpty);
    setSelectedCategory('Todos');
    const url = new URL(window.location.href);
    if (segmentSlugOrEmpty) {
      url.searchParams.set('segmento', segmentSlugOrEmpty);
    } else {
      url.searchParams.delete('segmento');
      url.searchParams.delete('segment');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Reliable clipboard copy helper with fallback for sandboxed iframes
  const copyTextToClipboard = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // Ignore fallback errors
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  // Build shareable URL for a Seller and/or a specific Segment Catalog
  // Automatically converts private development origin (ais-dev-) to public shared origin (ais-pre-)
  const buildShareableCatalogUrl = (sellerId?: string, segmentSlug?: string): string => {
    const publicOrigin = window.location.origin.replace('//ais-dev-', '//ais-pre-');
    const url = new URL(publicOrigin + window.location.pathname);
    url.searchParams.set('catalogo', 'cliente');
    if (sellerId && sellerId !== 'atendimento_geral') {
      url.searchParams.set('vendedor', sellerId);
    }
    if (segmentSlug) {
      url.searchParams.set('segmento', segmentSlug);
    }
    return url.toString();
  };

  const copySellerCatalogUrl = (seller: Seller, segmentSlug?: string) => {
    const targetUrl = buildShareableCatalogUrl(seller.id, segmentSlug);
    copyTextToClipboard(targetUrl);
    setCopiedSellerId(seller.id);
    setTimeout(() => setCopiedSellerId(null), 2200);
  };

  const copySegmentCatalogUrl = (segment: Segment, sellerId?: string) => {
    const targetUrl = buildShareableCatalogUrl(sellerId, segment.slug);
    copyTextToClipboard(targetUrl);
    setCopiedCatalogKey(segment.id);
    setTimeout(() => setCopiedCatalogKey(null), 2200);
  };

  // Record product visualization for a lead in Firestore (visitor only, +1 increment rules)
  const recordProductViewInFirestore = useCallback(
    async (lead: Lead, product: Product) => {
      const uid = await ensureAuthUid();
      if (!uid || lead.clientUid !== uid) {
        return;
      }

      const viewDocId = sanitizeId(product.id);
      const viewRef = doc(db, 'leads', lead.id, 'views', viewDocId);

      try {
        const viewSnap = await getDoc(viewRef);
        if (viewSnap.exists()) {
          const currentCount = Number(viewSnap.data().viewCount) || 1;
          await updateDoc(viewRef, {
            viewCount: currentCount + 1,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(viewRef, {
            ownerId: WORKSPACE_OWNER_ID,
            leadId: lead.id,
            sellerId: lead.sellerId,
            productId: product.id,
            productName: product.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
            productCategory: product.category.slice(0, VALIDATION_LIMITS.PRODUCT_CATEGORY_MAX),
            productPrice: product.price,
            productImage: product.primaryImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
            viewCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const leadRef = doc(db, 'leads', lead.id);
        const leadSnap = await getDoc(leadRef);
        const currentTotalViews = leadSnap.exists()
          ? Number(leadSnap.data().totalViews) || 0
          : lead.totalViews || 0;

        await updateDoc(leadRef, {
          totalViews: currentTotalViews + 1,
          lastViewedProductName: product.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `leads/${lead.id}/views/${viewDocId}`
        );
      }
    },
    [ensureAuthUid]
  );

  // Displayed products
  const displayProducts: Product[] = useMemo(() => {
    if (products.length > 0) return products;
    return INITIAL_PRODUCTS.map((p) => ({
      ...p,
      ownerId: WORKSPACE_OWNER_ID,
      createdAt: null as unknown as Product['createdAt'],
      updatedAt: null as unknown as Product['updatedAt'],
    }));
  }, [products]);

  // Resolved list of favorited products (Wishlist)
  const favoriteProducts: Product[] = useMemo(() => {
    if (favoriteProductIds.length === 0) return [];
    const idSet = new Set(favoriteProductIds);
    return displayProducts.filter((p) => {
      if (isClientMode && permissions.clientHideOutOfStock && !p.inStock) {
        return false;
      }
      return idSet.has(p.id);
    });
  }, [displayProducts, favoriteProductIds, isClientMode, permissions.clientHideOutOfStock]);

  // Toggle product in client Favorites / Wishlist
  const toggleFavoriteProduct = useCallback(
    async (product: Product, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isAlreadyFav = favoriteProductIds.includes(product.id);
      setFavoriteProductIds((prev) =>
        prev.includes(product.id)
          ? prev.filter((id) => id !== product.id)
          : [...prev, product.id]
      );

      // When a client favorites an item for the first time, also record interest in the lead/session
      if (!isAlreadyFav) {
        if (currentActiveLead) {
          await recordProductViewInFirestore(currentActiveLead, product);
        } else {
          setPendingSessionViews((prev) =>
            prev.includes(product.id) ? prev : [...prev, product.id]
          );
        }
      }
    },
    [favoriteProductIds, currentActiveLead, recordProductViewInFirestore]
  );

  // Open product detail modal & track visualization
  const handleInspectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setActiveGalleryIndex(0);

    if (currentActiveLead) {
      await recordProductViewInFirestore(currentActiveLead, product);
    } else {
      setPendingSessionViews((prev) =>
        prev.includes(product.id) ? prev : [...prev, product.id]
      );
    }
  };

  // Open Full-Screen Image Lightbox for any image list
  const openImageLightbox = useCallback(
    (
      images: string[],
      initialIndex = 0,
      title = 'Visualização Ampliada',
      subtitle?: string,
      product?: Product
    ) => {
      const validImages = images.filter(Boolean);
      if (validImages.length === 0) return;
      const safeIndex = Math.max(0, Math.min(initialIndex, validImages.length - 1));
      setLightboxZoom(1);
      setLightboxState({
        images: validImages,
        activeIndex: safeIndex,
        title,
        subtitle,
        product,
      });
    },
    []
  );

  // Open Full-Screen Image Lightbox for a Product (tracks client lead visualization when in Client Mode)
  const openProductLightbox = useCallback(
    async (product: Product, initialIndex = 0) => {
      const gallery =
        Array.isArray(product.galleryImages) && product.galleryImages.length > 0
          ? product.galleryImages
          : [product.primaryImage];
      const { productCode, manufacturerRef } = parseProductCodeAndRef(product);
      const subtitleParts = [
        showProductCodeInCatalog ? `Cód: ${productCode}` : '',
        showManufacturerRefInCatalog && manufacturerRef ? `Ref: ${manufacturerRef}` : '',
        showPricesInCatalog ? `${formatCurrency(product.price)} (PB-10X)` : '',
      ].filter(Boolean);

      openImageLightbox(
        gallery,
        initialIndex,
        product.name,
        subtitleParts.join(' · '),
        product
      );

      if (currentActiveLead) {
        await recordProductViewInFirestore(currentActiveLead, product);
      } else {
        setPendingSessionViews((prev) =>
          prev.includes(product.id) ? prev : [...prev, product.id]
        );
      }
    },
    [
      currentActiveLead,
      showProductCodeInCatalog,
      showManufacturerRefInCatalog,
      showPricesInCatalog,
      openImageLightbox,
      recordProductViewInFirestore,
    ]
  );

  // Keyboard shortcuts for Lightbox (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!lightboxState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxState(null);
      } else if (e.key === 'ArrowLeft' && lightboxState.images.length > 1) {
        setLightboxZoom(1);
        setLightboxState((prev) =>
          prev
            ? {
                ...prev,
                activeIndex:
                  prev.activeIndex === 0
                    ? prev.images.length - 1
                    : prev.activeIndex - 1,
              }
            : null
        );
      } else if (e.key === 'ArrowRight' && lightboxState.images.length > 1) {
        setLightboxZoom(1);
        setLightboxState((prev) =>
          prev
            ? {
                ...prev,
                activeIndex:
                  prev.activeIndex === prev.images.length - 1
                    ? 0
                    : prev.activeIndex + 1,
              }
            : null
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxState]);

  // Register client lead (Name + Phone — optional or required based on Admin config!) and attribute to active Seller + sync any viewed products
  const handleCreateClientLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadFormError(null);

    const trimmedName = clientNameInput.trim();
    const trimmedPhone = clientPhoneInput.trim();

    if (permissions.clientRequireIdentification) {
      if (trimmedName.length < 2) {
        setLeadFormError('Por favor, informe seu nome ou empresa (mínimo 2 caracteres).');
        return;
      }
      if (trimmedPhone.length < 8) {
        setLeadFormError('Por favor, informe um telefone ou WhatsApp válido com DDD.');
        return;
      }
    }

    // If filling Name and Phone is NOT mandatory and both are blank, go straight to the catalog
    if (!trimmedName && !trimmedPhone) {
      setShowLeadModal(false);
      setClientStep('catalog');
      if (pendingProductToOpen) {
        setSelectedProduct(pendingProductToOpen);
        setActiveGalleryIndex(0);
        setPendingProductToOpen(null);
      }
      return;
    }

    const safeClientName =
      trimmedName.length >= 2 ? trimmedName : trimmedName ? `${trimmedName} (Cliente)` : 'Cliente Visitante';
    const safeClientPhone =
      trimmedPhone.length >= 8
        ? trimmedPhone
        : trimmedPhone
          ? `${trimmedPhone} (S/DDD)`
          : 'Não informado';

    setLeadSubmitting(true);
    try {
      // Wait for anonymous login (or current user login) to complete before creating lead or views
      const clientUid = await ensureAuthUid();

      const newLeadId = sanitizeId(`lead_${safeClientName}_${Date.now().toString().slice(-5)}`);
      const initialProductsToSync = pendingProductToOpen
        ? Array.from(new Set([...pendingSessionViews, pendingProductToOpen.id]))
        : pendingSessionViews;

      await setDoc(doc(db, 'leads', newLeadId), {
        ownerId: WORKSPACE_OWNER_ID,
        sellerId: currentSeller.id,
        sellerName: currentSeller.name.slice(0, VALIDATION_LIMITS.SELLER_NAME_MAX),
        clientName: safeClientName.slice(0, VALIDATION_LIMITS.LEAD_NAME_MAX),
        clientPhone: safeClientPhone.slice(0, VALIDATION_LIMITS.LEAD_PHONE_MAX),
        status: 'novo',
        totalViews: 0,
        lastViewedProductName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        clientUid,
      });

      // Record all products already clicked in this session (+1 totalViews per write, viewCount = 1)
      let runningTotalViews = 0;
      for (const prodId of initialProductsToSync) {
        const prod = displayProducts.find((p) => p.id === prodId);
        if (prod) {
          const viewDocId = sanitizeId(prod.id);
          await setDoc(doc(db, 'leads', newLeadId, 'views', viewDocId), {
            ownerId: WORKSPACE_OWNER_ID,
            leadId: newLeadId,
            sellerId: currentSeller.id,
            productId: prod.id,
            productName: prod.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
            productCategory: prod.category.slice(0, VALIDATION_LIMITS.PRODUCT_CATEGORY_MAX),
            productPrice: prod.price,
            productImage: prod.primaryImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
            viewCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          runningTotalViews += 1;
          await updateDoc(doc(db, 'leads', newLeadId), {
            totalViews: runningTotalViews,
            lastViewedProductName: prod.name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
            updatedAt: serverTimestamp(),
          });
        }
      }

      localStorage.setItem('campos_equip_lead_id', newLeadId);
      setActiveLeadId(newLeadId);
      setInspectedLeadId(newLeadId);
      setPendingSessionViews([]);
      setClientNameInput('');
      setClientPhoneInput('');
      setShowLeadModal(false);
      setClientStep('catalog');

      if (pendingProductToOpen) {
        setSelectedProduct(pendingProductToOpen);
        setActiveGalleryIndex(0);
        setPendingProductToOpen(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leads');
      setClientStep('catalog');
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleResetClientSession = () => {
    localStorage.removeItem('campos_equip_lead_id');
    setActiveLeadId(null);
    setPendingSessionViews([]);
    setClientNameInput('');
    setClientPhoneInput('');
    if (isClientMode) {
      setClientStep('welcome');
    } else {
      setShowLeadModal(true);
    }
  };

  // LGPD self-service deletion: deletes the client's own views and then the lead document
  const handleClientDeleteOwnDataLgpd = async () => {
    try {
      const uid = auth.currentUser?.uid || authUid;
      if (uid) {
        const ownLeads = leads.filter((l) => l.clientUid === uid);
        for (const ownLead of ownLeads) {
          const viewsSnap = await getDocs(collection(db, 'leads', ownLead.id, 'views'));
          for (const vDoc of viewsSnap.docs) {
            await deleteDoc(doc(db, 'leads', ownLead.id, 'views', vDoc.id));
          }
          await deleteDoc(doc(db, 'leads', ownLead.id));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leads/self_lgpd');
    } finally {
      try {
        localStorage.removeItem('campos_equip_lead_id');
      } catch {
        // ignore storage errors
      }
      setActiveLeadId(null);
      setPendingSessionViews([]);
      setClientDataClearedNotice(true);
      setTimeout(() => setClientDataClearedNotice(false), 3500);
    }
  };

  // Update Lead pipeline status in CRM (team only alters status and updatedAt)
  const handleUpdateLeadStatus = async (lead: Lead, nextStatus: LeadStatus) => {
    if (lead.status === 'convertido' || lead.status === nextStatus) return;
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!canDeleteLeads) {
      openAdminLoginPrompt();
      return;
    }
    try {
      const viewsSnap = await getDocs(collection(db, 'leads', leadId, 'views'));
      for (const vDoc of viewsSnap.docs) {
        await deleteDoc(doc(db, 'leads', leadId, 'views', vDoc.id));
      }
      await deleteDoc(doc(db, 'leads', leadId));
      if (activeLeadId === leadId) {
        localStorage.removeItem('campos_equip_lead_id');
        setActiveLeadId(null);
      }
      if (inspectedLeadId === leadId) {
        setInspectedLeadId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${leadId}`);
    }
  };

  // Add new Seller
  const handleAddSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSellers) {
      openAdminLoginPrompt();
      return;
    }
    setSellerFormError(null);

    const name = newSellerName.trim();
    const role = newSellerRole.trim();
    const whatsapp = newSellerWhatsapp.trim();

    if (name.length < 2 || name.length > VALIDATION_LIMITS.SELLER_NAME_MAX) {
      setSellerFormError('Nome do vendedor deve ter entre 2 e 80 caracteres.');
      return;
    }
    if (role.length < 2 || role.length > VALIDATION_LIMITS.SELLER_ROLE_MAX) {
      setSellerFormError('Informe o cargo ou especialidade (2 a 80 caracteres).');
      return;
    }
    if (whatsapp.length < 8 || whatsapp.length > VALIDATION_LIMITS.SELLER_WHATSAPP_MAX) {
      setSellerFormError('Informe um WhatsApp válido (8 a 30 caracteres).');
      return;
    }

    const slug = sanitizeId(name);
    const sellerId = sanitizeId(`seller_${slug}_${Date.now().toString().slice(-4)}`);

    try {
      await setDoc(doc(db, 'sellers', sellerId), {
        ownerId: WORKSPACE_OWNER_ID,
        name,
        roleTitle: role,
        whatsapp,
        slug,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSellerName('');
      setNewSellerRole('');
      setNewSellerWhatsapp('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `sellers/${sellerId}`);
    }
  };

  // Toggle Seller Active / Inactive status in Firestore
  const handleToggleSellerActive = async (seller: Seller) => {
    if (!canManageSellers) {
      openAdminLoginPrompt();
      return;
    }
    const nextActive = seller.active === false ? true : false;
    try {
      await updateDoc(doc(db, 'sellers', seller.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });

      // If inactivating the currently selected seller in the catalog simulator, switch to another active seller
      if (!nextActive && activeSellerId === seller.id) {
        const fallbackSeller = sellers.find(
          (s) => s.id !== seller.id && s.active !== false
        );
        if (fallbackSeller) {
          selectSellerLink(fallbackSeller);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sellers/${seller.id}`);
    }
  };

  // Permanently delete a Seller from Firestore
  const handleDeleteSeller = async (seller: Seller) => {
    if (!canManageSellers) {
      openAdminLoginPrompt();
      return;
    }
    try {
      await deleteDoc(doc(db, 'sellers', seller.id));
      if (activeSellerId === seller.id) {
        const remaining = sellers.find((s) => s.id !== seller.id && s.active !== false);
        if (remaining) {
          selectSellerLink(remaining);
        } else {
          setActiveSellerId('');
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sellers/${seller.id}`);
    }
  };

  // Start editing a Seller's Name, Role, or Phone/WhatsApp
  const startEditingSeller = (seller: Seller) => {
    if (!canManageSellers) {
      openAdminLoginPrompt();
      return;
    }
    setEditingSellerId(seller.id);
    setEditSellerName(seller.name);
    setEditSellerRole(seller.roleTitle);
    setEditSellerWhatsapp(seller.whatsapp);
    setEditSellerError(null);
  };

  const handleSaveSellerEdit = async (e: React.FormEvent, seller: Seller) => {
    e.preventDefault();
    if (!canManageSellers) {
      openAdminLoginPrompt();
      return;
    }
    setEditSellerError(null);

    const name = editSellerName.trim();
    const role = editSellerRole.trim();
    const whatsapp = editSellerWhatsapp.trim();

    if (name.length < 2 || name.length > VALIDATION_LIMITS.SELLER_NAME_MAX) {
      setEditSellerError('O nome do vendedor deve ter entre 2 e 80 caracteres.');
      return;
    }
    if (role.length < 2 || role.length > VALIDATION_LIMITS.SELLER_ROLE_MAX) {
      setEditSellerError('O cargo/especialidade deve ter entre 2 e 80 caracteres.');
      return;
    }
    if (
      whatsapp.length < 8 ||
      whatsapp.length > VALIDATION_LIMITS.SELLER_WHATSAPP_MAX ||
      normalizePhoneDigits(whatsapp).length < 8
    ) {
      setEditSellerError(
        'O telefone/WhatsApp do vendedor deve conter pelo menos 8 dígitos numéricos.'
      );
      return;
    }

    const slug = sanitizeId(name);
    try {
      await updateDoc(doc(db, 'sellers', seller.id), {
        name,
        roleTitle: role,
        whatsapp,
        slug,
        updatedAt: serverTimestamp(),
      });
      setEditingSellerId(null);
      setPermissionSaveToast(`Dados do vendedor ${name} atualizados com sucesso!`);
      setTimeout(() => setPermissionSaveToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sellers/${seller.id}`);
    }
  };

  // Add new Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateOrDeleteProducts) {
      openAdminLoginPrompt();
      return;
    }
    setProdFormError(null);

    const name = newProdName.trim();
    const codeInput = newProdSku.trim();
    const refInput = newProdManufacturerRef.trim();
    const sku = formatSkuWithCodeAndRef(codeInput, refInput);
    const chosenSegments =
      newProdSegments.length > 0 ? newProdSegments : [newProdCategory.trim() || 'Geral'];
    const category = formatProductSegments(chosenSegments);
    const priceNum = Number(newProdPrice);
    const dimensions = newProdDimensions.trim();
    const material = newProdMaterial.trim();
    const description = newProdDesc.trim();

    if (name.length < 2 || name.length > VALIDATION_LIMITS.PRODUCT_NAME_MAX) {
      setProdFormError('Nome do produto deve ter entre 2 e 120 caracteres.');
      return;
    }
    if (codeInput.length < 1) {
      setProdFormError('Informe o código do produto.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setProdFormError('Informe um preço válido.');
      return;
    }
    if (description.length < 5 || description.length > VALIDATION_LIMITS.PRODUCT_DESC_MAX) {
      setProdFormError('Descrição deve ter entre 5 e 1000 caracteres.');
      return;
    }

    const prodId = sanitizeId(`prod_${codeInput}_${Date.now().toString().slice(-4)}`);
    const resolvedDimensions = dimensions || 'Padrão Comercial 220V';
    const resolvedMaterial = material || 'Aço Inox Comercial';

    const autoGallery = buildProductGalleryFromMetadata({
      name,
      sku,
      dimensions: resolvedDimensions,
      material: resolvedMaterial,
      category,
    });
    const finalPrimaryImg = isGenericPlaceholderImage(newProdPrimaryImg)
      ? autoGallery.primaryImage
      : newProdPrimaryImg;
    const gallery = isGenericPlaceholderImage(newProdPrimaryImg)
      ? autoGallery.galleryImages
      : Array.from(new Set([finalPrimaryImg, ...newProdExtraImgs])).slice(
          0,
          VALIDATION_LIMITS.PRODUCT_GALLERY_MAX
        );

    try {
      await setDoc(doc(db, 'products', prodId), {
        ownerId: WORKSPACE_OWNER_ID,
        sku,
        name,
        category,
        price: priceNum,
        description,
        dimensions: resolvedDimensions,
        material: resolvedMaterial,
        primaryImage: finalPrimaryImg.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
        galleryImages: gallery,
        inStock: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewProdName('');
      setNewProdSku('');
      setNewProdManufacturerRef('');
      setNewProdPrice('');
      setNewProdDimensions('');
      setNewProdMaterial('');
      setNewProdDesc('');
      setShowNewProductForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `products/${prodId}`);
    }
  };

  // Open Full Product Registration Edit Modal for ANY Product
  const openProductEditModal = (product: Product, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!canEditProducts) {
      openAdminLoginPrompt(() => openProductEditModalDirect(product));
      return;
    }
    openProductEditModalDirect(product);
  };

  const openProductEditModalDirect = (product: Product) => {
    // Close other product modals so the registration editor is always front and center
    setSelectedProduct(null);
    setPhotoModalProduct(null);

    const { productCode, manufacturerRef, cleanDimensions } =
      parseProductCodeAndRef(product);

    const safeName = product.name || '';
    const safePrice = String(product.price ?? 0);
    const parsedSegs = parseProductSegments(product.category || '');
    const safeSegs =
      parsedSegs.length > 0 ? parsedSegs : [product.category || 'Refrigeração & Cervejeiras'];
    const safeDimensions = cleanDimensions || 'Padrão Comercial 220V';
    const safeMaterial = product.material || 'Aço Inox Comercial';
    const safeDesc =
      product.description ||
      `${safeName} (Cód. ${productCode}) com condições especiais da tabela PB-10X.`;
    const safePrimary = product.primaryImage || IMG_REFRIGERACAO;
    const safeGallery =
      Array.isArray(product.galleryImages) && product.galleryImages.length > 0
        ? product.galleryImages
        : [safePrimary];

    setEditingProduct(product);
    setEditProdName(safeName);
    setEditProdSku(productCode);
    setEditProdManufacturerRef(manufacturerRef);
    setEditProdPrice(safePrice);
    setEditProdSegments(safeSegs);
    setEditProdDimensions(safeDimensions);
    setEditProdMaterial(safeMaterial);
    setEditProdDesc(safeDesc);
    setEditProdInStock(product.inStock !== false);
    setEditProdPrimaryImg(safePrimary);
    setEditProdGalleryImgs(safeGallery);
    setEditProdError(null);
    setQuickSegNameInModal('');
  };

  // Upload photo inside Edit Product Modal
  const handleEditProductPhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!canManagePhotos && !canEditProducts) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const uploaded: string[] = [];
      let totalOrig = 0;
      let totalOpt = 0;
      let lastStats: ImageOptimizationStats | null = null;
      for (let i = 0; i < files.length; i++) {
        const stats = await optimizeImageFileWithStats(
          files[i],
          1280,
          960,
          false,
          68 * 1024
        );
        uploaded.push(stats.dataUrl);
        totalOrig += stats.originalBytes;
        totalOpt += stats.optimizedBytes;
        lastStats = stats;
      }
      setEditProdPrimaryImg(uploaded[0]);
      setEditProdGalleryImgs((prev) =>
        Array.from(new Set([...uploaded, ...prev])).slice(
          0,
          VALIDATION_LIMITS.PRODUCT_GALLERY_MAX
        )
      );
      if (lastStats) {
        const savings =
          totalOrig > totalOpt
            ? Math.min(99, Math.max(1, Math.round((1 - totalOpt / totalOrig) * 100)))
            : 0;
        setPhotoCompressionReport(
          `Foto otimizada em ${lastStats.formatLabel} (${lastStats.width}×${lastStats.height}px): de ${formatKilobytes(
            totalOrig
          )} para apenas ${formatKilobytes(totalOpt)}${
            savings > 0 ? ` (-${savings}% de tamanho)` : ''
          }!`
        );
      }
    } catch (err) {
      setEditProdError(
        err instanceof Error ? err.message : 'Erro ao carregar foto do produto.'
      );
    } finally {
      if (editProductPhotoInputRef.current) {
        editProductPhotoInputRef.current.value = '';
      }
    }
  };

  // Save full Product Registration changes to Firestore
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !canEditProducts) return;
    setEditProdError(null);

    const name = editProdName.trim();
    const codeInput = editProdSku.trim();
    const refInput = editProdManufacturerRef.trim();
    const sku = formatSkuWithCodeAndRef(codeInput, refInput);
    const priceNum = canEditPrices ? Number(editProdPrice) : editingProduct.price;
    const dimensions = editProdDimensions.trim();
    const material = editProdMaterial.trim();
    const description = editProdDesc.trim();
    const primaryImage = editProdPrimaryImg.trim() || editingProduct.primaryImage;

    if (name.length < 2 || name.length > VALIDATION_LIMITS.PRODUCT_NAME_MAX) {
      setEditProdError('O nome do produto deve ter entre 2 e 120 caracteres.');
      return;
    }
    if (codeInput.length < 1) {
      setEditProdError('Informe o código do produto.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setEditProdError('Informe um preço válido.');
      return;
    }
    if (editProdSegments.length === 0) {
      setEditProdError('Marque pelo menos 1 segmento ao qual este produto pertence.');
      return;
    }
    if (dimensions.length < 2 || dimensions.length > VALIDATION_LIMITS.PRODUCT_DIM_MAX) {
      setEditProdError('Especificação/Dimensões deve ter entre 2 e 120 caracteres.');
      return;
    }
    if (material.length < 2 || material.length > VALIDATION_LIMITS.PRODUCT_MAT_MAX) {
      setEditProdError('Fabricante/Material deve ter entre 2 e 120 caracteres.');
      return;
    }
    if (description.length < 5 || description.length > VALIDATION_LIMITS.PRODUCT_DESC_MAX) {
      setEditProdError('A descrição deve ter entre 5 e 1000 caracteres.');
      return;
    }

    const categoryStr = canManageSegments
      ? formatProductSegments(editProdSegments)
      : editingProduct.category;
    const gallery = Array.from(
      new Set([primaryImage, ...editProdGalleryImgs.filter(Boolean)])
    ).slice(0, VALIDATION_LIMITS.PRODUCT_GALLERY_MAX);

    setEditProdSaving(true);
    try {
      await setDoc(doc(db, 'products', editingProduct.id), {
        ownerId: WORKSPACE_OWNER_ID,
        sku: sku.slice(0, VALIDATION_LIMITS.PRODUCT_SKU_MAX),
        name: name.slice(0, VALIDATION_LIMITS.PRODUCT_NAME_MAX),
        category: categoryStr,
        price: priceNum,
        description: description.slice(0, VALIDATION_LIMITS.PRODUCT_DESC_MAX),
        dimensions: dimensions.slice(0, VALIDATION_LIMITS.PRODUCT_DIM_MAX),
        material: material.slice(0, VALIDATION_LIMITS.PRODUCT_MAT_MAX),
        primaryImage: primaryImage.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
        galleryImages: gallery,
        inStock: editProdInStock,
        createdAt: editingProduct.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${editingProduct.id}`);
    } finally {
      setEditProdSaving(false);
    }
  };

  // Delete a Product from Firestore
  const handleDeleteProduct = async (product: Product) => {
    if (!canCreateOrDeleteProducts) {
      openAdminLoginPrompt();
      return;
    }
    try {
      await deleteDoc(doc(db, 'products', product.id));
      if (editingProduct?.id === product.id) {
        setEditingProduct(null);
      }
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
    }
  };

  const handleToggleProductStock = async (product: Product) => {
    if (!canEditProducts) {
      openAdminLoginPrompt();
      return;
    }
    try {
      await setDoc(doc(db, 'products', product.id), {
        ownerId: WORKSPACE_OWNER_ID,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description,
        dimensions: product.dimensions,
        material: product.material,
        primaryImage: product.primaryImage,
        galleryImages: product.galleryImages,
        inStock: !product.inStock,
        createdAt: product.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  // Toggle (check / uncheck) whether a Product belongs to a specific Segment
  const handleToggleProductSegmentMembership = async (
    product: Product,
    segmentName: string
  ) => {
    if (!canManageSegments) {
      openAdminLoginPrompt();
      return;
    }
    const currentSegs = parseProductSegments(product.category);
    const exists = currentSegs.some(
      (s) => s.toLowerCase() === segmentName.trim().toLowerCase()
    );
    let nextSegs: string[];
    if (exists) {
      if (currentSegs.length <= 1) {
        // Keep at least 1 segment assigned
        return;
      }
      nextSegs = currentSegs.filter(
        (s) => s.toLowerCase() !== segmentName.trim().toLowerCase()
      );
    } else {
      nextSegs = [...currentSegs, segmentName.trim()];
    }

    const nextCategoryStr = formatProductSegments(nextSegs);
    try {
      await setDoc(doc(db, 'products', product.id), {
        ownerId: WORKSPACE_OWNER_ID,
        sku: product.sku,
        name: product.name,
        category: nextCategoryStr,
        price: product.price,
        description: product.description,
        dimensions: product.dimensions,
        material: product.material,
        primaryImage: product.primaryImage,
        galleryImages: product.galleryImages,
        inStock: product.inStock,
        createdAt: product.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  // Quick-create a Segment inline (e.g., inside the Product Edit modal or New Product form)
  const handleQuickCreateSegment = async (
    rawName: string,
    onCreated?: (createdName: string) => void
  ) => {
    if (!canManageSegments) {
      openAdminLoginPrompt();
      return;
    }
    const name = rawName.trim();
    if (name.length < 2 || name.length > VALIDATION_LIMITS.SEGMENT_NAME_MAX) return;
    const slug = sanitizeId(name);
    const segId = sanitizeId(`seg_${slug}`);
    const desc = `Catálogo especializado de equipamentos do segmento ${name} com condições da tabela PB-10X.`;

    setQuickSegSaving(true);
    try {
      await setDoc(doc(db, 'segments', segId), {
        ownerId: WORKSPACE_OWNER_ID,
        name,
        slug,
        description: desc.slice(0, VALIDATION_LIMITS.SEGMENT_DESC_MAX),
        coverImage: IMG_REFRIGERACAO,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setQuickSegNameInModal('');
      if (onCreated) onCreated(name);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `segments/${segId}`);
    } finally {
      setQuickSegSaving(false);
    }
  };

  // Upload cover photo inside New/Edit Segment Form
  const handleNewSegmentPhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const stats = await optimizeImageFileWithStats(file, 1280, 960, false, 68 * 1024);
      setNewSegmentCover(stats.dataUrl);
    } catch (err) {
      setSegmentFormError(
        err instanceof Error ? err.message : 'Erro ao carregar imagem do segmento.'
      );
    } finally {
      if (newSegmentPhotoInputRef.current) {
        newSegmentPhotoInputRef.current.value = '';
      }
    }
  };

  // Open Segment Form to edit an existing Segment
  const openEditSegmentForm = (seg: Segment) => {
    if (!canManageSegments) {
      openAdminLoginPrompt();
      return;
    }
    setEditingSegmentId(seg.id);
    setNewSegmentName(seg.name);
    setNewSegmentDesc(seg.description);
    setNewSegmentCover(seg.coverImage || IMG_REFRIGERACAO);
    setSegmentFormError(null);
    setShowNewSegmentForm(true);
  };

  // Create or Update a Product Segment in Firestore
  const handleAddSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSegments) {
      openAdminLoginPrompt();
      return;
    }
    setSegmentFormError(null);

    const name = newSegmentName.trim();
    const desc =
      newSegmentDesc.trim() ||
      `Catálogo especializado de equipamentos do segmento ${name} com condições da tabela PB-10X.`;

    if (name.length < 2 || name.length > VALIDATION_LIMITS.SEGMENT_NAME_MAX) {
      setSegmentFormError('O nome do segmento deve ter entre 2 e 60 caracteres.');
      return;
    }
    if (desc.length < 5 || desc.length > VALIDATION_LIMITS.SEGMENT_DESC_MAX) {
      setSegmentFormError('A descrição do segmento deve ter entre 5 e 300 caracteres.');
      return;
    }

    const slug = sanitizeId(name);
    const segId = editingSegmentId || sanitizeId(`seg_${slug}`);
    const existingSeg = segments.find((s) => s.id === segId);

    try {
      await setDoc(doc(db, 'segments', segId), {
        ownerId: WORKSPACE_OWNER_ID,
        name,
        slug,
        description: desc,
        coverImage: newSegmentCover.slice(0, VALIDATION_LIMITS.PRODUCT_IMG_MAX),
        createdAt: existingSeg?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSegmentName('');
      setNewSegmentDesc('');
      setEditingSegmentId(null);
      setShowNewSegmentForm(false);
      setNewProdCategory(name);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `segments/${segId}`);
    }
  };

  const handleDeleteSegment = async (segment: Segment) => {
    if (!canManageSegments) {
      openAdminLoginPrompt();
      return;
    }
    try {
      await deleteDoc(doc(db, 'segments', segment.id));
      if (
        activeSegmentParam &&
        (activeSegmentParam === segment.slug ||
          activeSegmentParam === segment.id ||
          activeSegmentParam.toLowerCase() === segment.name.toLowerCase())
      ) {
        selectSegmentCatalog('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `segments/${segment.id}`);
    }
  };

  // Resolved list of all Segments (Firestore segments + fallback + any custom product categories)
  const displaySegments: Segment[] = useMemo(() => {
    const baseList: Segment[] =
      segments.length > 0
        ? segments
        : INITIAL_SEGMENTS.map((s) => ({
            ...s,
            ownerId: WORKSPACE_OWNER_ID,
            createdAt: null as unknown as Segment['createdAt'],
            updatedAt: null as unknown as Segment['createdAt'],
          }));

    const byName = new Map<string, Segment>();
    baseList.forEach((seg) => byName.set(seg.name.toLowerCase(), seg));

    displayProducts.forEach((p) => {
      const prodSegs = parseProductSegments(p.category);
      prodSegs.forEach((segName) => {
        const key = segName.toLowerCase();
        if (key && !byName.has(key)) {
          const slug = sanitizeId(segName);
          byName.set(key, {
            id: `seg_${slug}`,
            ownerId: WORKSPACE_OWNER_ID,
            name: segName,
            slug,
            description: `Catálogo dedicado de equipamentos da linha ${segName}.`,
            coverImage: p.primaryImage || IMG_REFRIGERACAO,
            createdAt: null as unknown as Segment['createdAt'],
            updatedAt: null as unknown as Segment['updatedAt'],
          });
        }
      });
    });

    return Array.from(byName.values());
  }, [segments, displayProducts]);

  // Resolved active Segment when the user/client opens or selects a Segment Catalog (?segmento=...)
  const currentSegmentCatalog: Segment | null = useMemo(() => {
    if (!activeSegmentParam.trim()) return null;
    const target = activeSegmentParam.trim().toLowerCase();
    return (
      displaySegments.find(
        (s) =>
          s.slug.toLowerCase() === target ||
          s.id.toLowerCase() === target ||
          s.name.toLowerCase() === target
      ) || null
    );
  }, [displaySegments, activeSegmentParam]);

  const categories = useMemo(() => {
    const set = new Set<string>(['Todos']);
    displaySegments.forEach((s) => set.add(s.name));
    displayProducts.forEach((p) => {
      parseProductSegments(p.category).forEach((segName) => set.add(segName));
    });
    return Array.from(set);
  }, [displaySegments, displayProducts]);

  const filteredProducts = useMemo(() => {
    return displayProducts.filter((p) => {
      // In Client Mode, if Admin enabled "Ocultar produtos sem estoque", hide out-of-stock products
      if (isClientMode && permissions.clientHideOutOfStock && !p.inStock) {
        return false;
      }
      // If a Segment Catalog is active, this catalog shows products that belong to that segment
      if (
        currentSegmentCatalog &&
        !productBelongsToSegment(p, currentSegmentCatalog.name)
      ) {
        return false;
      }
      const matchesCat =
        selectedCategory === 'Todos'
          ? true
          : selectedCategory === 'Favoritos'
          ? favoriteProductIds.includes(p.id)
          : productBelongsToSegment(p, selectedCategory);
      const matchesQuery =
        !catalogSearch.trim() ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.material.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(catalogSearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [
    displayProducts,
    isClientMode,
    permissions.clientHideOutOfStock,
    currentSegmentCatalog,
    selectedCategory,
    favoriteProductIds,
    catalogSearch,
  ]);

  const leadsMatchingSellerAndSearch = useMemo(() => {
    const rawQuery = crmSearch.trim();
    const normalizedQuery = rawQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const queryDigits = rawQuery.replace(/\D/g, '');

    return leads.filter((l) => {
      // If logged in strictly as a Seller, restrict to their own captured leads for security
      if (authenticatedSeller && !isAdminAuthenticated && !authenticatedCollaborator) {
        if (l.sellerId !== authenticatedSeller.id) return false;
      }
      const matchesSeller = crmSellerFilter === 'todos' || l.sellerId === crmSellerFilter;
      if (!rawQuery) return matchesSeller;

      const normalizedClientName = (l.clientName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const normalizedSellerName = (l.sellerName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const rawPhoneLower = (l.clientPhone || '').toLowerCase();
      const phoneDigits = (l.clientPhone || '').replace(/\D/g, '');

      const matchesNameOrSeller =
        normalizedClientName.includes(normalizedQuery) ||
        normalizedSellerName.includes(normalizedQuery);
      const matchesPhone =
        rawPhoneLower.includes(normalizedQuery) ||
        (queryDigits.length > 0 && phoneDigits.includes(queryDigits));

      return matchesSeller && (matchesNameOrSeller || matchesPhone);
    });
  }, [
    leads,
    authenticatedSeller,
    isAdminAuthenticated,
    authenticatedCollaborator,
    crmSellerFilter,
    crmSearch,
  ]);

  const leadCountsByDatePeriod = useMemo(() => {
    return {
      todos: leadsMatchingSellerAndSearch.length,
      hoje: leadsMatchingSellerAndSearch.filter((l) => matchesLeadDateFilter(l, 'hoje')).length,
      dias7: leadsMatchingSellerAndSearch.filter((l) => matchesLeadDateFilter(l, '7dias')).length,
      dias30: leadsMatchingSellerAndSearch.filter((l) => matchesLeadDateFilter(l, '30dias'))
        .length,
    };
  }, [leadsMatchingSellerAndSearch]);

  const filteredLeads = useMemo(() => {
    return leadsMatchingSellerAndSearch.filter((l) =>
      matchesLeadDateFilter(l, crmDateFilter, crmCustomStartDate, crmCustomEndDate)
    );
  }, [leadsMatchingSellerAndSearch, crmDateFilter, crmCustomStartDate, crmCustomEndDate]);

  const inspectedLead = useMemo(() => {
    if (filteredLeads.length === 0) return null;
    if (!inspectedLeadId) return filteredLeads[0] || null;
    return filteredLeads.find((l) => l.id === inspectedLeadId) || filteredLeads[0] || null;
  }, [filteredLeads, inspectedLeadId]);

  const totalViewsAcrossFilteredLeads = useMemo(() => {
    return filteredLeads.reduce((acc, l) => acc + (l.totalViews || 0), 0);
  }, [filteredLeads]);

  const totalViewsAcrossAllLeads = useMemo(() => {
    return leads.reduce((acc, l) => acc + (l.totalViews || 0), 0);
  }, [leads]);

  const selectedFilteredLeads = useMemo(() => {
    return filteredLeads.filter((l) => selectedLeadIdsForPdf.includes(l.id));
  }, [filteredLeads, selectedLeadIdsForPdf]);

  const toggleLeadSelectionForPdf = useCallback((leadId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedLeadIdsForPdf((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  }, []);

  const toggleSelectAllFilteredLeadsForPdf = useCallback(() => {
    const filteredIds = filteredLeads.map((l) => l.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedLeadIdsForPdf.includes(id));
    if (allSelected) {
      setSelectedLeadIdsForPdf((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedLeadIdsForPdf((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }, [filteredLeads, selectedLeadIdsForPdf]);

  const handleExportLeadsPdf = useCallback(
    async (customLeads?: Lead[], customFileNamePrefix?: string) => {
      const targetLeads =
        customLeads && customLeads.length > 0
          ? customLeads
          : selectedFilteredLeads.length > 0
          ? selectedFilteredLeads
          : filteredLeads;

      if (targetLeads.length === 0) return;

      const periodMap: Record<LeadDateFilter, string> = {
        todos: 'Todos os Períodos',
        hoje: 'Hoje',
        '7dias': 'Últimos 7 dias',
        '30dias': 'Últimos 30 dias',
        personalizado:
          crmCustomStartDate || crmCustomEndDate
            ? `${crmCustomStartDate || 'Início'} a ${crmCustomEndDate || 'Hoje'}`
            : 'Período Personalizado',
      };

      const resolvedSellerName =
        crmSellerFilter === 'todos'
          ? authenticatedSeller && !isAdminAuthenticated && !authenticatedCollaborator
            ? authenticatedSeller.name
            : 'Todos os Vendedores'
          : sellers.find((s) => s.id === crmSellerFilter)?.name || 'Vendedor Selecionado';

      setExportingLeadsPdf(true);
      try {
        await exportLeadsAndViewsToPdf({
          leadsToExport: targetLeads,
          viewsByLead,
          companyLogoUrl,
          defaultLogoUrl: DEFAULT_COMPANY_LOGO,
          periodLabel: periodMap[crmDateFilter] || 'Todos os Períodos',
          sellerLabel: resolvedSellerName,
          formatDateTime,
          fileNamePrefix: customFileNamePrefix || 'relatorio-leads-visualizacoes',
        });
      } finally {
        setExportingLeadsPdf(false);
      }
    },
    [
      selectedFilteredLeads,
      filteredLeads,
      crmDateFilter,
      crmCustomStartDate,
      crmCustomEndDate,
      crmSellerFilter,
      authenticatedSeller,
      isAdminAuthenticated,
      authenticatedCollaborator,
      sellers,
      viewsByLead,
      companyLogoUrl,
    ]
  );

  // Daily volume of captured leads over the last 30 days (for Recharts visualization)
  const leadsLast30DaysChartData = useMemo(() => {
    const now = new Date();
    const buckets: Array<{
      dateIso: string;
      dayLabel: string;
      fullDateLabel: string;
      leads: number;
      visualizacoes: number;
    }> = [];

    const bucketMap = new Map<
      string,
      {
        dateIso: string;
        dayLabel: string;
        fullDateLabel: string;
        leads: number;
        visualizacoes: number;
      }
    >();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const dayLabel = `${dd}/${mm}`;
      const fullDateLabel = `${dd}/${mm}/${yyyy}`;
      const entry = {
        dateIso,
        dayLabel,
        fullDateLabel,
        leads: 0,
        visualizacoes: 0,
      };
      buckets.push(entry);
      bucketMap.set(dateIso, entry);
    }

    leadsMatchingSellerAndSearch.forEach((lead) => {
      const captureDate = getLeadCaptureDate(lead);
      const yyyy = captureDate.getFullYear();
      const mm = String(captureDate.getMonth() + 1).padStart(2, '0');
      const dd = String(captureDate.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const foundBucket = bucketMap.get(key);
      if (foundBucket) {
        foundBucket.leads += 1;
        foundBucket.visualizacoes += lead.totalViews || 0;
      }
    });

    return buckets;
  }, [leadsMatchingSellerAndSearch]);

  const leadsLast30DaysSummary = useMemo(() => {
    let total30d = 0;
    let peakCount = 0;
    let peakDateLabel = '—';
    let daysWithCaptures = 0;

    for (const item of leadsLast30DaysChartData) {
      total30d += item.leads;
      if (item.leads > 0) {
        daysWithCaptures += 1;
      }
      if (item.leads > peakCount) {
        peakCount = item.leads;
        peakDateLabel = item.fullDateLabel;
      }
    }

    return {
      total30d,
      peakCount,
      peakDateLabel,
      daysWithCaptures,
    };
  }, [leadsLast30DaysChartData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <OfflineIndicator />
      {/* =====================================================================
          CLIENT LINK MODE:
          Step 1 (welcome): Initial screen asking ONLY for Name & Phone
          Step 2 (catalog): Clean Product Catalog without any admin menus
         ===================================================================== */}
      {isClientMode ? (
        clientStep === 'welcome' ? (
          <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#F8FAFC]">
            {isPreviewingClientFromInternal && (
              <div className="w-full max-w-md mb-4 bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                <span>Pré-visualização da Tela do Cliente</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsClientMode(false);
                    setIsPreviewingClientFromInternal(false);
                  }}
                  className="px-2.5 py-1 bg-white text-slate-900 font-semibold rounded-md hover:bg-slate-100 cursor-pointer"
                >
                  ← Voltar ao Painel
                </button>
              </div>
            )}

            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              {/* Company Logo */}
              <div className="flex justify-center mb-6 pb-5 border-b border-slate-100">
                <img
                  src={companyLogoUrl}
                  alt="Logomarca da Empresa"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                  }}
                  className="max-h-14 w-auto object-contain"
                />
              </div>

              {/* Seller & Segment Attribution */}
              <div className="text-center mb-6">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
                  {currentSegmentCatalog
                    ? `Catálogo de ${currentSegmentCatalog.name}`
                    : 'Catálogo Digital de Equipamentos'}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 font-sans mb-2">
                  Bem-vindo ao Catálogo
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Catálogo enviado por <strong>{currentSeller.name}</strong>.{' '}
                  {permissions.clientRequireIdentification
                    ? 'Informe seu nome e telefone abaixo para liberar o acesso aos produtos.'
                    : 'Informe seu nome e telefone abaixo ou acesse diretamente os produtos (o preenchimento não é obrigatório).'}
                </p>
              </div>

              <form onSubmit={handleCreateClientLead} className="space-y-4">
                <div>
                  <label
                    htmlFor="client-welcome-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Seu Nome ou Empresa{' '}
                    <span className="text-slate-400 font-normal">
                      {permissions.clientRequireIdentification ? '(Obrigatório)' : '(Opcional)'}
                    </span>
                  </label>
                  <input
                    id="client-welcome-name"
                    type="text"
                    required={permissions.clientRequireIdentification}
                    placeholder="Ex: João Silva / Padaria Estrela"
                    value={clientNameInput}
                    onChange={(e) => setClientNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-welcome-phone"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Telefone / WhatsApp{' '}
                    <span className="text-slate-400 font-normal">
                      {permissions.clientRequireIdentification ? '(Obrigatório)' : '(Opcional)'}
                    </span>
                  </label>
                  <input
                    id="client-welcome-phone"
                    type="tel"
                    required={permissions.clientRequireIdentification}
                    placeholder="Ex: (11) 99999-0000"
                    value={clientPhoneInput}
                    onChange={(e) => setClientPhoneInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-mono-tabular"
                  />
                </div>

                {leadFormError && (
                  <p className="text-xs text-red-700 font-medium">{leadFormError}</p>
                )}

                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="w-full py-3 px-4 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {leadSubmitting ? 'Abrindo Catálogo...' : 'Acessar Catálogo de Produtos'}
                </button>

                {!permissions.clientRequireIdentification && (
                  <button
                    type="button"
                    onClick={() => setClientStep('catalog')}
                    className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Continuar sem preencher →
                  </button>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <PWAInstallButton
                    variant="welcome-card"
                    isInstalled={isInstalled}
                    isInstallable={isInstallable}
                    onOpenModal={() => setShowPWAInstallerModal(true)}
                    onDirectInstall={async () => {
                      const res = await promptInstall();
                      if (res !== 'accepted') setShowPWAInstallerModal(true);
                    }}
                  />
                </div>
              </form>
            </div>
          </main>
        ) : (
          /* STEP 2 OF CLIENT LINK: CLEAN PRODUCT CATALOG ONLY */
          <div className="flex-1 flex flex-col">
            {isPreviewingClientFromInternal && (
              <div className="bg-slate-900 text-white px-6 lg:px-12 py-2 flex items-center justify-between text-xs">
                <span>
                  Pré-visualização da Visão do Cliente (aplicando regras de visibilidade do
                  Administrador)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsClientMode(false);
                    setIsPreviewingClientFromInternal(false);
                  }}
                  className="px-3 py-1 bg-white text-slate-900 font-semibold rounded-md hover:bg-slate-100 cursor-pointer"
                >
                  ← Voltar ao Painel Interno
                </button>
              </div>
            )}

            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-12 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <img
                  src={companyLogoUrl}
                  alt="Logomarca da Empresa"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                  }}
                  className="max-h-10 w-auto object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 text-xs">
                <span className="text-slate-500 hidden sm:inline">
                  Consultor: <strong className="text-slate-900 font-semibold">{currentSeller.name}</strong>
                </span>

                {/* Favorites / Wishlist Menu Button in Client Catalog Header */}
                <button
                  type="button"
                  onClick={() => setShowFavoritesModal(true)}
                  title="Ver sua Lista de Desejos / Favoritos"
                  className={`px-3 py-1.5 text-xs font-semibold border rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    favoriteProducts.length > 0
                      ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      favoriteProducts.length > 0
                        ? 'fill-red-600 text-red-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span>Favoritos</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md font-mono-tabular ${
                      favoriteProducts.length > 0
                        ? 'bg-red-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {favoriteProducts.length}
                  </span>
                </button>

                {currentActiveLead ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50/70">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[140px]">{currentActiveLead.clientName}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClientStep('welcome')}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Identificar-se
                  </button>
                )}

                {permissions.clientShowWhatsappButton &&
                  currentSeller.whatsapp &&
                  currentSeller.id !== 'atendimento_geral' && (
                    <a
                      href={`https://wa.me/55${currentSeller.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Olá ${currentSeller.name}, estou vendo o catálogo de equipamentos e gostaria de atendimento.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Falar com {currentSeller.name.split(' ')[0]}</span>
                    </a>
                  )}

                <PWAInstallButton
                  variant="header-client"
                  isInstalled={isInstalled}
                  isInstallable={isInstallable}
                  onOpenModal={() => setShowPWAInstallerModal(true)}
                  onDirectInstall={async () => {
                    const res = await promptInstall();
                    if (res !== 'accepted') setShowPWAInstallerModal(true);
                  }}
                />
              </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-8">
              {/* Catalog Title & Filter/Search Bar */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-red-700 mb-1">
                    {currentSegmentCatalog
                      ? `Catálogo Exclusivo · ${currentSegmentCatalog.name}`
                      : 'Catálogo Digital de Equipamentos'}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-sans tracking-tight">
                    {currentSegmentCatalog
                      ? currentSegmentCatalog.name
                      : selectedCategory === 'Favoritos'
                      ? `Meus Favoritos (${favoriteProducts.length})`
                      : 'Equipamentos Disponíveis'}
                  </h1>
                </div>

                {favoriteProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFavoritesModal(true)}
                    className="self-start sm:self-auto px-3.5 py-2 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-red-600 text-red-600" />
                    <span>
                      Abrir Lista de Desejos ({favoriteProducts.length}{' '}
                      {favoriteProducts.length === 1 ? 'item' : 'itens'})
                    </span>
                  </button>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200/80">
                {currentSegmentCatalog ? (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      Exibindo <strong className="text-slate-900">{filteredProducts.length}</strong> equipamentos do segmento{' '}
                      <strong className="text-slate-900">{currentSegmentCatalog.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === 'Favoritos' ? 'Todos' : 'Favoritos'
                        )
                      }
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        selectedCategory === 'Favoritos'
                          ? 'bg-red-700 text-white border-red-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Heart
                        className={`w-3 h-3 ${
                          selectedCategory === 'Favoritos'
                            ? 'fill-white text-white'
                            : 'fill-red-600 text-red-600'
                        }`}
                      />
                      <span>Favoritos ({favoriteProducts.length})</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Favoritos')}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        selectedCategory === 'Favoritos'
                          ? 'bg-red-700 text-white shadow-2xs'
                          : 'text-red-700 hover:bg-red-50'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          selectedCategory === 'Favoritos'
                            ? 'fill-white text-white'
                            : 'fill-red-600 text-red-600'
                        }`}
                      />
                      <span>Favoritos ({favoriteProducts.length})</span>
                    </button>
                  </div>
                )}

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar produto ou código..."
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-white border border-slate-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Clean Client Product Grid */}
              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
                  <p className="text-base font-medium text-slate-800 mb-1">
                    {selectedCategory === 'Favoritos'
                      ? 'Sua lista de Favoritos ainda está vazia'
                      : 'Nenhum equipamento encontrado para esta busca'}
                  </p>
                  {selectedCategory === 'Favoritos' && (
                    <p className="text-xs text-slate-500 mb-3">
                      Clique no ícone de coração nos produtos do catálogo para salvá-los aqui.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('Todos');
                      setCatalogSearch('');
                    }}
                    className="mt-3 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Ver Todos os Produtos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    const productSegList = parseProductSegments(product.category);
                    const { productCode, manufacturerRef, cleanDimensions } =
                      parseProductCodeAndRef(product);
                    const isFavorited = favoriteProductIds.includes(product.id);
                    return (
                      <article
                        key={product.id}
                        onClick={() => handleInspectProduct(product)}
                        className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductLightbox(product, 0);
                          }}
                          title="Clique na imagem para ampliar em tela cheia"
                          className="aspect-[4/3] w-full bg-white overflow-hidden relative border-b border-slate-100 p-3 flex items-center justify-center cursor-zoom-in"
                        >
                          <SafeImage
                            src={product.primaryImage}
                            alt={product.name}
                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-103"
                          />

                          {/* Heart / Favorite Button on Card */}
                          <button
                            type="button"
                            onClick={(e) => toggleFavoriteProduct(product, e)}
                            title={
                              isFavorited
                                ? 'Remover dos Favoritos'
                                : 'Adicionar aos Favoritos / Lista de Desejos'
                            }
                            aria-label={
                              isFavorited
                                ? 'Remover dos Favoritos'
                                : 'Adicionar aos Favoritos'
                            }
                            className={`absolute top-3 left-3 z-10 w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                              isFavorited
                                ? 'bg-red-50/95 border-red-200 text-red-600 scale-105'
                                : 'bg-white/95 border-slate-200/90 text-slate-500 hover:text-red-600 hover:border-red-200'
                            }`}
                          >
                            <Heart
                              className={`w-4 h-4 transition-transform ${
                                isFavorited ? 'fill-red-600 text-red-600' : ''
                              }`}
                            />
                          </button>

                          <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xs">
                            <Maximize2 className="w-3 h-3" />
                            <span>Ampliar Foto</span>
                          </span>
                        </div>

                        <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1.5">
                              <span className="text-red-700 font-medium truncate">
                                {productSegList.join(' · ')}
                              </span>
                              {permissions.clientShowPhotosCount && (
                                <span className="font-mono-tabular shrink-0">
                                  {product.galleryImages.length} fotos
                                </span>
                              )}
                            </div>

                            <h2 className="text-[15px] font-semibold text-slate-900 group-hover:text-red-700 transition-colors mb-1.5 font-sans leading-snug line-clamp-2 min-h-[2.6rem]">
                              {product.name}
                            </h2>

                            {(permissions.clientShowProductCode ||
                              (permissions.clientShowManufacturerRef && manufacturerRef)) && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono-tabular mb-2">
                                {permissions.clientShowProductCode && (
                                  <span>Cód: {productCode}</span>
                                )}
                                {permissions.clientShowProductCode &&
                                  permissions.clientShowManufacturerRef &&
                                  manufacturerRef && <span aria-hidden="true">·</span>}
                                {permissions.clientShowManufacturerRef && manufacturerRef && (
                                  <span>Ref: {manufacturerRef}</span>
                                )}
                              </div>
                            )}

                            {permissions.clientShowDimensionsAndMaterial && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                                {product.material} · {cleanDimensions}
                              </p>
                            )}
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div>
                              {permissions.clientShowPrices ? (
                                <>
                                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tabela PB-10X</div>
                                  <span className="text-base font-bold text-slate-900 font-mono-tabular">
                                    {formatCurrency(product.price)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Condição Comercial</div>
                                  <span className="text-sm font-semibold text-slate-800">
                                    Sob consulta
                                  </span>
                                </>
                              )}
                            </div>

                            <span className="px-3 py-1.5 rounded-lg bg-slate-50 group-hover:bg-red-50 text-xs font-medium text-slate-700 group-hover:text-red-700 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0">
                              <span>Detalhes</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </main>
          </div>
        )
      ) : !isInternalUserAuthenticated ? (
        /* =====================================================================
           EMAIL/PASSWORD LOGIN PORTAL FOR TEAM (ADMIN, COLLABORATORS & SELLERS)
           ===================================================================== */
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#F8FAFC]">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Company Logo */}
            <div className="flex justify-center mb-5 pb-4 border-b border-slate-100">
              <img
                src={companyLogoUrl}
                alt="Logomarca da Empresa"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                }}
                className="max-h-13 w-auto object-contain"
              />
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Acesso da Equipe</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 font-sans">
                Entrar no Catálogo
              </h1>
              <p className="text-xs text-slate-500 mt-1.5">
                Acesso exclusivo para Administrador, Colaboradores e Vendedores autorizados. Entre com seu e-mail e senha.
              </p>
            </div>

            <EmailLoginForm externalError={adminLoginError} />

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Acesso seguro</span>
              <button
                type="button"
                onClick={() => {
                  setClientStep('welcome');
                  setIsPreviewingClientFromInternal(true);
                  setIsClientMode(true);
                }}
                className="text-red-700 font-semibold hover:underline cursor-pointer"
              >
                Abrir Visão do Cliente →
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* STRICT 3-ZONE TOP BAR CONTRACT WITH COMPANY LOGO SLOT IN ZONE 1 (INTERNAL PANEL) */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-6 px-6 lg:px-12 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
            {/* Zone 1: Company Logo Slot */}
            <div className="flex items-center gap-3 shrink-0">
              {canChangeLogo ? (
                <button
                  type="button"
                  onClick={() => {
                    setLogoUrlInput(
                      companyLogoUrl === DEFAULT_COMPANY_LOGO ? '' : companyLogoUrl
                    );
                    setShowLogoModal(true);
                  }}
                  title="Clique para enviar ou alterar a logomarca da empresa"
                  className="group relative flex items-center justify-center h-11 px-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shrink-0"
                >
                  <img
                    src={companyLogoUrl}
                    alt="Logomarca da Empresa"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                    }}
                    className="max-h-10 w-auto object-contain"
                  />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 px-2 py-0.5 text-[10px] font-medium bg-slate-900 text-white rounded whitespace-nowrap">
                    Logo
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-center h-11 px-2 shrink-0">
                  <img
                    src={companyLogoUrl}
                    alt="Logomarca da Empresa"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                    }}
                    className="max-h-10 w-auto object-contain"
                  />
                </div>
              )}
            </div>

            {/* Zone 2: Navigation links */}
            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setActiveTab('catalogo')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  activeTab === 'catalogo'
                    ? 'text-slate-900 border-b-2 border-red-700 font-semibold'
                    : ''
                }`}
              >
                Catálogo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('leads')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  activeTab === 'leads'
                    ? 'text-slate-900 border-b-2 border-red-700 font-semibold'
                    : ''
                }`}
              >
                Leads ({leadsMatchingSellerAndSearch.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('vendedores')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  activeTab === 'vendedores'
                    ? 'text-slate-900 border-b-2 border-red-700 font-semibold'
                    : ''
                }`}
              >
                Vendedores
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('produtos')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  activeTab === 'produtos'
                    ? 'text-slate-900 border-b-2 border-red-700 font-semibold'
                    : ''
                }`}
              >
                Produtos
              </button>
              {isAdminAuthenticated && (
                <button
                  type="button"
                  onClick={() => setActiveTab('seguranca')}
                  className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                    activeTab === 'seguranca'
                      ? 'text-slate-900 border-b-2 border-red-700 font-semibold'
                      : ''
                  }`}
                >
                  Permissões
                </button>
              )}
            </nav>

            {/* Zone 3: Clean User Identity & Primary Action */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdminAuthenticated ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('seguranca')}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    title="Sair da conta"
                    className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : authenticatedCollaborator ? (
                <div className="flex items-center gap-1.5">
                  <div className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-800 rounded-xl flex items-center gap-1.5 whitespace-nowrap">
                    <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                    <span className="truncate max-w-[110px]">{authenticatedCollaborator.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    title="Sair da conta"
                    className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : authenticatedSeller ? (
                <div className="flex items-center gap-1.5">
                  <div className="px-3 py-1.5 text-xs font-medium bg-slate-100/80 border border-slate-200/80 text-slate-800 rounded-xl flex items-center gap-1.5 whitespace-nowrap">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="truncate max-w-[120px]">{authenticatedSeller.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    title="Sair da conta"
                    className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}

              <PWAInstallButton
                variant="header-internal"
                isInstalled={isInstalled}
                isInstallable={isInstallable}
                onOpenModal={() => setShowPWAInstallerModal(true)}
                onDirectInstall={async () => {
                  const res = await promptInstall();
                  if (res !== 'accepted') setShowPWAInstallerModal(true);
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setClientStep('welcome');
                  setIsPreviewingClientFromInternal(true);
                  setIsClientMode(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 rounded-xl hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visão do Cliente</span>
              </button>
            </div>
          </header>

          {/* Mobile Secondary Navigation Strip */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto px-4 py-2 bg-white border-b border-slate-200/80">
            {(
              [
                { id: 'catalogo', label: 'Catálogo' },
                { id: 'leads', label: `Leads (${leadsMatchingSellerAndSearch.length})` },
                { id: 'vendedores', label: 'Vendedores' },
                { id: 'produtos', label: 'Produtos' },
                ...(isAdminAuthenticated
                  ? [{ id: 'seguranca' as WorkspaceTab, label: 'Permissões' }]
                  : []),
              ] as { id: WorkspaceTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>


          {/* =====================================================================
              VIEW 1: CATÁLOGO DO CLIENTE (EQUIPAMENTOS E REFRIGERAÇÃO)
             ===================================================================== */}
          {activeTab === 'catalogo' && (
        <main className="flex-1">
          {/* Light & Fluid Seller + Segment Catalog Toolbar */}
          <div className="bg-white/70 border-b border-slate-200/70 px-6 lg:px-12 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left: Seller & Segment Catalog Chooser */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                <span className="text-slate-400">Vendedor:</span>
                {activeSellers.length > 1 &&
                (isAdminAuthenticated || Boolean(authenticatedCollaborator)) ? (
                  <select
                    id="seller-sim-select"
                    value={currentSeller.id}
                    onChange={(e) => {
                      const found = activeSellers.find((s) => s.id === e.target.value);
                      if (found) selectSellerLink(found);
                    }}
                    className="bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-400"
                  >
                    {activeSellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong className="text-slate-900 font-semibold">{currentSeller.name}</strong>
                )}

                <span aria-hidden="true" className="text-slate-300">·</span>

                <label htmlFor="segment-catalog-select" className="text-slate-400">
                  Segmento:
                </label>
                <select
                  id="segment-catalog-select"
                  value={currentSegmentCatalog ? currentSegmentCatalog.slug : ''}
                  onChange={(e) => selectSegmentCatalog(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Todos os Segmentos</option>
                  {displaySegments.map((seg) => {
                    const count = displayProducts.filter((p) =>
                      productBelongsToSegment(p, seg.name)
                    ).length;
                    return (
                      <option key={seg.id} value={seg.slug}>
                        {seg.name} ({count})
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const urlToCopy = buildShareableCatalogUrl(
                      currentSeller.id,
                      currentSegmentCatalog?.slug
                    );
                    copyTextToClipboard(urlToCopy);
                    setCopiedCatalogKey('topbar_catalog');
                    setTimeout(() => setCopiedCatalogKey(null), 2200);
                  }}
                  className="px-3 py-1 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedCatalogKey === 'topbar_catalog' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Link Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right: Client Lead Status & Favorites Menu Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowFavoritesModal(true)}
                  title="Ver Lista de Desejos / Favoritos"
                  className={`px-3 py-1 text-xs font-semibold border rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    favoriteProducts.length > 0
                      ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      favoriteProducts.length > 0
                        ? 'fill-red-600 text-red-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span>Favoritos ({favoriteProducts.length})</span>
                </button>

                {currentActiveLead ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      Cliente: <strong className="text-slate-900">{currentActiveLead.clientName}</strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono-tabular text-emerald-700 font-medium">
                      {currentActiveLead.totalViews} vistos
                    </span>
                    <button
                      type="button"
                      onClick={handleResetClientSession}
                      className="text-slate-400 hover:text-slate-900 underline ml-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Trocar cliente
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400">
                      {pendingSessionViews.length > 0
                        ? `${pendingSessionViews.length} item visto nesta sessão`
                        : 'Simulação de atendimento'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLeadModal(true)}
                      className="px-3 py-1 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Identificar Cliente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Storefront Split Hero (Adapts dynamically when a Segment Catalog is selected) */}
          <section className="max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left 7 cols: Campaign Presentation & Lead Form */}
              <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-8 lg:p-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
                    <span className="font-semibold text-red-700">
                      {currentSegmentCatalog
                        ? `CATÁLOGO EXCLUSIVO DO SEGMENTO · ${currentSegmentCatalog.name.toUpperCase()}`
                        : 'CATÁLOGO COMPLETO DE EQUIPAMENTOS'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Tabela Oficial PB-10X</span>
                    <span aria-hidden="true">·</span>
                    <span>Vendedor: {currentSeller.name}</span>
                  </div>

                  <h1
                    className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-[1.15] mb-4 font-sans"
                    style={{ textWrap: 'balance' }}
                  >
                    {currentSegmentCatalog
                      ? `Catálogo de ${currentSegmentCatalog.name}`
                      : 'Equipamentos para gastronomia, panificação, açougue e supermercados.'}
                  </h1>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mb-6">
                    {currentSegmentCatalog ? (
                      <>
                        {currentSegmentCatalog.description} Seleção enviada por{' '}
                        <strong>{currentSeller.name}</strong> com condições da tabela{' '}
                        <strong>PB-10X</strong>. Informe seu nome e telefone abaixo para registrar
                        seu atendimento e consultar fotos e fichas técnicas deste segmento.
                      </>
                    ) : (
                      <>
                        Catálogo oficial com preços da tabela <strong>PB-10X</strong> enviado por{' '}
                        <strong>{currentSeller.name}</strong>. Informe seu nome e telefone abaixo
                        para registrar seu atendimento no banco de dados e visualizar fotos,
                        especificações e condições de cada equipamento.
                      </>
                    )}
                  </p>

                  {currentSegmentCatalog && (
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      <button
                        type="button"
                        onClick={() => copySegmentCatalogUrl(currentSegmentCatalog, currentSeller.id)}
                        className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedCatalogKey === currentSegmentCatalog.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Link deste Segmento Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Enviar este Catálogo de {currentSegmentCatalog.name}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => selectSegmentCatalog('')}
                        className="px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Ver Todos os Segmentos ({displayProducts.length} itens)
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Client Lead Capture Block */}
                {!currentActiveLead ? (
                  <form
                    onSubmit={handleCreateClientLead}
                    className="pt-6 border-t border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-900">
                        Identifique-se para salvar os equipamentos consultados com{' '}
                        {currentSeller.name}
                      </span>
                      <span className="text-xs text-slate-500">Salvo automaticamente</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label htmlFor="hero-client-name" className="sr-only">
                          Seu Nome ou Empresa
                        </label>
                        <input
                          id="hero-client-name"
                          type="text"
                          required
                          placeholder="Seu nome ou nome da empresa"
                          value={clientNameInput}
                          onChange={(e) => setClientNameInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label htmlFor="hero-client-phone" className="sr-only">
                          Seu Telefone / WhatsApp
                        </label>
                        <input
                          id="hero-client-phone"
                          type="tel"
                          required
                          placeholder="Telefone / WhatsApp com DDD"
                          value={clientPhoneInput}
                          onChange={(e) => setClientPhoneInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-mono-tabular"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <button
                          type="submit"
                          disabled={leadSubmitting}
                          className="w-full h-full px-4 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {leadSubmitting ? 'Salvando...' : 'Liberar Catálogo'}
                        </button>
                      </div>
                    </div>

                    {leadFormError && (
                      <p className="mt-2 text-xs text-red-700 font-medium">{leadFormError}</p>
                    )}
                  </form>
                ) : (
                  <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">
                        Atendimento vinculado ao vendedor {currentActiveLead.sellerName}
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        Olá, <strong>{currentActiveLead.clientName}</strong> — os equipamentos que
                        você abrir abaixo ficam salvos na sua cotação.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedLeadId(currentActiveLead.id);
                          setActiveTab('leads');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Ver Ficha no Painel do Vendedor
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right 5 cols: Segment / Industrial Equipment Showcase + PDF Table Button */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden border-b border-slate-200">
                  <SafeImage
                    src={
                      currentSegmentCatalog
                        ? currentSegmentCatalog.coverImage
                        : IMG_REFRIGERACAO
                    }
                    alt={
                      currentSegmentCatalog
                        ? currentSegmentCatalog.name
                        : 'Equipamentos Comerciais e Refrigeração'
                    }
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">
                      {currentSegmentCatalog
                        ? `Segmento: ${currentSegmentCatalog.name}`
                        : 'Tabela Oficial IdealSoft · 494 Registros'}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {currentSegmentCatalog
                        ? `${filteredProducts.length} equipamentos disponíveis neste catálogo`
                        : 'G Paniz · Fricon · Venâncio · Progás · Bermar · Iglu · Polar · Balmak'}
                    </p>
                  </div>
                  {canViewPdfTable && (
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-700" />
                      <span>Abrir PDF Original</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 1B: Segment Catalogs Strip (Allows turning any Segment into a dedicated Catalog or creating a new Segment) */}
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 font-sans">
                    Catálogos por Segmento — Escolha ou crie um segmento para virar um catálogo exclusivo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ao selecionar ou copiar o link de um segmento, o cliente visualizará um catálogo
                    dedicado apenas com os equipamentos marcados naquele segmento.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {currentSegmentCatalog && (
                    <button
                      type="button"
                      onClick={() => selectSegmentCatalog('')}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Voltar ao Catálogo Completo
                    </button>
                  )}

                  {canManageSegments && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSegmentId(null);
                        setNewSegmentName('');
                        setNewSegmentDesc('');
                        setNewSegmentCover(IMG_REFRIGERACAO);
                        setShowNewSegmentForm((v) => !v);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showNewSegmentForm ? 'Fechar Novo Segmento' : 'Criar Novo Segmento'}</span>
                    </button>
                  )}
                </div>
              </div>

              {showNewSegmentForm && (
                <form
                  onSubmit={handleAddSegment}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      {editingSegmentId ? 'Editar Segmento' : 'Criar Novo Segmento de Produtos'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewSegmentForm(false);
                        setEditingSegmentId(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nome do Segmento
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Pizzarias & Hamburguerias"
                        value={newSegmentName}
                        onChange={(e) => setNewSegmentName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Descrição do Catálogo deste Segmento
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Fornos, masseiras, chapas e refrigeração para pizzarias."
                        value={newSegmentDesc}
                        onChange={(e) => setNewSegmentDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  {segmentFormError && (
                    <p className="text-xs text-red-700 font-medium">{segmentFormError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {editingSegmentId ? 'Salvar Alterações do Segmento' : 'Salvar Novo Segmento'}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {displaySegments.map((seg) => {
                  const isCurrentSeg = currentSegmentCatalog?.id === seg.id;
                  const count = displayProducts.filter((p) =>
                    productBelongsToSegment(p, seg.name)
                  ).length;
                  const isSegCopied = copiedCatalogKey === seg.id;

                  return (
                    <div
                      key={seg.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrentSeg
                          ? 'border-red-700 bg-red-50/30 shadow-2xs'
                          : 'border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        onClick={() => selectSegmentCatalog(isCurrentSeg ? '' : seg.slug)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-11 h-10 rounded-lg overflow-hidden bg-white border border-slate-200/80 shrink-0">
                          <SafeImage
                            src={seg.coverImage}
                            alt={seg.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {seg.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular">
                            {count} {count === 1 ? 'item' : 'itens'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => selectSegmentCatalog(isCurrentSeg ? '' : seg.slug)}
                          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                            isCurrentSeg
                              ? 'bg-red-700 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isCurrentSeg ? 'Ativo' : 'Abrir'}
                        </button>

                        <button
                          type="button"
                          onClick={() => copySegmentCatalogUrl(seg, currentSeller.id)}
                          title={`Copiar link do catálogo de ${seg.name}`}
                          className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                        >
                          {isSegCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 2: Featured Collection Filter Bar & 3-Column Grid */}
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
              {/* Interactive Category Filter Buttons (when in Full Catalog mode) or Active Segment Header */}
              {currentSegmentCatalog ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold text-slate-900">
                    Exibindo Catálogo do Segmento: {currentSegmentCatalog.name} (
                    {filteredProducts.length} itens)
                  </span>
                  <button
                    type="button"
                    onClick={() => selectSegmentCatalog('')}
                    className="text-xs font-semibold text-red-700 underline hover:text-red-800 cursor-pointer"
                  >
                    Mostrar todos os segmentos
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Favoritos')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      selectedCategory === 'Favoritos'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-red-700 hover:bg-white/60'
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        selectedCategory === 'Favoritos'
                          ? 'fill-white text-white'
                          : 'fill-red-600 text-red-600'
                      }`}
                    />
                    <span>Favoritos ({favoriteProducts.length})</span>
                  </button>
                </div>
              )}

              {/* Search Input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por código (ex: 181498), marca ou nome..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Product Grid (3 columns on desktop, uniform aspect ratio) */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <p className="text-base font-medium text-slate-800 mb-1">
                  {selectedCategory === 'Favoritos'
                    ? 'Nenhum equipamento marcado como favorito ainda'
                    : 'Nenhum equipamento encontrado para este filtro'}
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  {selectedCategory === 'Favoritos'
                    ? 'Clique no ícone de coração em qualquer card de produto para salvá-lo na sua Lista de Desejos.'
                    : 'Experimente limpar a busca ou selecionar outra linha de equipamentos.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Todos');
                    setCatalogSearch('');
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Mostrar Todos os Equipamentos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => {
                  const leadViewsForProduct = currentActiveLead
                    ? (viewsByLead[currentActiveLead.id] || []).find(
                        (v) => v.productId === product.id
                      )
                    : null;
                  const viewedInSession =
                    Boolean(leadViewsForProduct) || pendingSessionViews.includes(product.id);
                  const productSegList = parseProductSegments(product.category);
                  const { productCode, manufacturerRef, cleanDimensions } =
                    parseProductCodeAndRef(product);
                  const isFavorited = favoriteProductIds.includes(product.id);

                  return (
                    <article
                      key={product.id}
                      onClick={() => handleInspectProduct(product)}
                      className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      {/* 4:3 Image Container with Adaptive Studio Fit & Click-to-Expand */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductLightbox(product, 0);
                        }}
                        title="Clique na imagem para expandir em tela cheia"
                        className="aspect-[4/3] w-full bg-white overflow-hidden relative border-b border-slate-100 p-3 flex items-center justify-center cursor-zoom-in"
                      >
                        <SafeImage
                          src={product.primaryImage}
                          alt={product.name}
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-103"
                        />

                        {/* Heart / Favorite Button on Card */}
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteProduct(product, e)}
                          title={
                            isFavorited
                              ? 'Remover dos Favoritos'
                              : 'Adicionar aos Favoritos / Lista de Desejos'
                          }
                          aria-label={
                            isFavorited
                              ? 'Remover dos Favoritos'
                              : 'Adicionar aos Favoritos'
                          }
                          className={`absolute top-3 left-3 z-10 w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            isFavorited
                              ? 'bg-red-50/95 border-red-200 text-red-600 scale-105'
                              : 'bg-white/95 border-slate-200/90 text-slate-500 hover:text-red-600 hover:border-red-200'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform ${
                              isFavorited ? 'fill-red-600 text-red-600' : ''
                            }`}
                          />
                        </button>

                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xs">
                          <Maximize2 className="w-3 h-3" />
                          <span>Ampliar Foto</span>
                        </span>

                        {(canEditProducts || canManagePhotos) && (
                          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                            {canEditProducts && (
                              <button
                                type="button"
                                onClick={(e) => openProductEditModal(product, e)}
                                title="Editar cadastro ou segmento deste equipamento"
                                className="px-2.5 py-1.5 text-[11px] font-medium bg-white/95 backdrop-blur-xs text-slate-800 border border-slate-200/90 rounded-lg shadow-xs hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                            )}

                            {canManagePhotos && (
                              <button
                                type="button"
                                onClick={(e) => openProductPhotoModal(product, e)}
                                title="Incluir ou gerenciar fotos deste equipamento"
                                className="px-2.5 py-1.5 text-[11px] font-medium bg-white/95 backdrop-blur-xs text-slate-800 border border-slate-200/90 rounded-lg shadow-xs hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Foto</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Body: Clean Unboxed Metadata & Balanced Typography */}
                      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1.5">
                            <span className="font-medium text-red-700 truncate">
                              {productSegList.join(' · ')}
                            </span>
                            <span className="font-mono-tabular shrink-0">
                              {product.galleryImages.length} fotos
                            </span>
                          </div>

                          <h2 className="text-[15px] font-semibold text-slate-900 group-hover:text-red-700 transition-colors mb-1.5 font-sans leading-snug line-clamp-2 min-h-[2.6rem]">
                            {product.name}
                          </h2>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono-tabular mb-2">
                            <span>Cód: {productCode}</span>
                            {manufacturerRef && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Ref: {manufacturerRef}</span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                            {product.material} · {cleanDimensions}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tabela PB-10X</div>
                            <span className="text-base font-bold text-slate-900 font-mono-tabular">
                              {formatCurrency(product.price)}
                            </span>
                          </div>

                          <span className="px-3 py-1.5 rounded-lg bg-slate-50 group-hover:bg-slate-900 text-xs font-medium text-slate-700 group-hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap shrink-0">
                            {viewedInSession ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-600 group-hover:text-emerald-300" />
                                <span>
                                  Visto
                                  {leadViewsForProduct
                                    ? ` (${leadViewsForProduct.viewCount}x)`
                                    : ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>Ver Ficha</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* =====================================================================
          VIEW 2: LEADS & ACESSOS (SELLER CRM & REAL-TIME PRODUCT VIEW TRACKING)
         ===================================================================== */}
      {activeTab === 'leads' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-10">
          {/* Top Summary Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 mb-8 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span>CRM Comercial · Banco de Dados Interno</span>
                <span aria-hidden="true">·</span>
                <span>Rastreamento de Visualizações por Cliente</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight font-sans">
                Leads Capturados & Equipamentos Visualizados
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="grid grid-cols-3 gap-6 bg-white border border-slate-200 rounded-xl px-6 py-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {crmDateFilter === 'todos' && crmSellerFilter === 'todos' && !crmSearch.trim()
                      ? 'Total de Leads'
                      : 'Leads no Período'}
                  </div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-tabular flex items-baseline gap-1.5">
                    <span>{filteredLeads.length}</span>
                    {(crmDateFilter !== 'todos' ||
                      crmSellerFilter !== 'todos' ||
                      Boolean(crmSearch.trim())) && (
                      <span className="text-xs font-normal text-slate-400">
                        / {leads.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <div className="text-xs text-slate-500">
                    {crmDateFilter === 'todos' && crmSellerFilter === 'todos' && !crmSearch.trim()
                      ? 'Visualizações de Itens'
                      : 'Visualizações no Período'}
                  </div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-tabular flex items-baseline gap-1.5">
                    <span>{totalViewsAcrossFilteredLeads}</span>
                    {(crmDateFilter !== 'todos' ||
                      crmSellerFilter !== 'todos' ||
                      Boolean(crmSearch.trim())) && (
                      <span className="text-xs font-normal text-slate-400">
                        / {totalViewsAcrossAllLeads}
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <div className="text-xs text-slate-500">Vendedores Ativos</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-tabular">
                    {activeSellers.length}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={filteredLeads.length === 0 || exportingLeadsPdf}
                onClick={() => handleExportLeadsPdf()}
                className="px-4 py-3.5 bg-red-700 hover:bg-red-800 disabled:opacity-45 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>
                  {exportingLeadsPdf
                    ? 'Gerando PDF...'
                    : selectedFilteredLeads.length > 0
                    ? `Exportar Selecionados (${selectedFilteredLeads.length}) em PDF`
                    : `Exportar Leads e Visualizações em PDF (${filteredLeads.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* 30-Day Captured Leads Volume Chart (Recharts) */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-red-700" />
                  <span>Evolução Diária · Últimos 30 Dias</span>
                  {crmSellerFilter !== 'todos' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700 font-medium">
                        Filtrado por Vendedor Selecionado
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900 font-sans">
                  Volume de Leads Capturados por Dia (Últimos 30 Dias)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-5 text-xs">
                  <div>
                    <span className="text-slate-500">Capturados (30 dias): </span>
                    <strong className="font-mono-tabular text-slate-900 font-bold">
                      {leadsLast30DaysSummary.total30d}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <div>
                    <span className="text-slate-500">Pico Diário: </span>
                    <strong className="font-mono-tabular text-slate-900 font-bold">
                      {leadsLast30DaysSummary.peakCount}{' '}
                      {leadsLast30DaysSummary.peakCount === 1 ? 'lead' : 'leads'}
                    </strong>
                    {leadsLast30DaysSummary.peakCount > 0 && (
                      <span className="text-slate-400 font-mono-tabular ml-1">
                        ({leadsLast30DaysSummary.peakDateLabel})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLeadsChartMode('barras')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      leadsChartMode === 'barras'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadsChartMode('area')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      leadsChartMode === 'area'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Linha / Área
                  </button>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {leadsChartMode === 'barras' ? (
                  <BarChart
                    data={leadsLast30DaysChartData}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      interval={2}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #1E293B',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      labelStyle={{
                        color: '#94A3B8',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                      itemStyle={{
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                      labelFormatter={(_label, payload) => {
                        const first = payload?.[0]?.payload as
                          | { fullDateLabel?: string }
                          | undefined;
                        return first?.fullDateLabel
                          ? `Data: ${first.fullDateLabel}`
                          : `Dia: ${String(_label)}`;
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const num = Number(value ?? 0);
                        if (name === 'leads') {
                          return [
                            `${num} ${num === 1 ? 'lead capturado' : 'leads capturados'}`,
                            'Volume',
                          ];
                        }
                        return [String(num), String(name)];
                      }}
                    />
                    <Bar
                      dataKey="leads"
                      name="leads"
                      fill="#B91C1C"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                ) : (
                  <AreaChart
                    data={leadsLast30DaysChartData}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="leadsVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B91C1C" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#B91C1C" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      interval={2}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #1E293B',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      labelStyle={{
                        color: '#94A3B8',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                      itemStyle={{
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                      labelFormatter={(_label, payload) => {
                        const first = payload?.[0]?.payload as
                          | { fullDateLabel?: string }
                          | undefined;
                        return first?.fullDateLabel
                          ? `Data: ${first.fullDateLabel}`
                          : `Dia: ${String(_label)}`;
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const num = Number(value ?? 0);
                        if (name === 'leads') {
                          return [
                            `${num} ${num === 1 ? 'lead capturado' : 'leads capturados'}`,
                            'Volume',
                          ];
                        }
                        return [String(num), String(name)];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="leads"
                      stroke="#B91C1C"
                      strokeWidth={2.2}
                      fillOpacity={1}
                      fill="url(#leadsVolumeGradient)"
                      activeDot={{ r: 5, fill: '#B91C1C', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>

          {/* Date Range Filter Bar + Seller & Search Filter Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 space-y-4">
            {/* Row 1: Date Interval Filter (Todos, Hoje, Últimos 7 dias, Últimos 30 dias, Personalizado) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 shrink-0">
                <Calendar className="w-4 h-4 text-red-700 shrink-0" />
                <span>Período de Captura:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCrmDateFilter('todos')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    crmDateFilter === 'todos'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todos os Períodos ({leadCountsByDatePeriod.todos})
                </button>
                <button
                  type="button"
                  onClick={() => setCrmDateFilter('hoje')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    crmDateFilter === 'hoje'
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Hoje ({leadCountsByDatePeriod.hoje})
                </button>
                <button
                  type="button"
                  onClick={() => setCrmDateFilter('7dias')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    crmDateFilter === '7dias'
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Últimos 7 dias ({leadCountsByDatePeriod.dias7})
                </button>
                <button
                  type="button"
                  onClick={() => setCrmDateFilter('30dias')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    crmDateFilter === '30dias'
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Últimos 30 dias ({leadCountsByDatePeriod.dias30})
                </button>
                <button
                  type="button"
                  onClick={() => setCrmDateFilter('personalizado')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    crmDateFilter === 'personalizado'
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Intervalo Personalizado
                </button>

                {(crmDateFilter !== 'todos' ||
                  crmSellerFilter !== 'todos' ||
                  Boolean(crmSearch.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCrmDateFilter('todos');
                      setCrmCustomStartDate('');
                      setCrmCustomEndDate('');
                      setCrmSellerFilter('todos');
                      setCrmSearch('');
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Optional Custom Date Range Picker when 'personalizado' is selected */}
            {crmDateFilter === 'personalizado' && (
              <div className="flex flex-wrap items-center gap-3 pt-1 pb-3 border-b border-slate-100 text-xs">
                <span className="font-medium text-slate-600">
                  Filtrar por datas específicas:
                </span>
                <label className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-500">De:</span>
                  <input
                    type="date"
                    value={crmCustomStartDate}
                    onChange={(e) => setCrmCustomStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-500">Até:</span>
                  <input
                    type="date"
                    value={crmCustomEndDate}
                    onChange={(e) => setCrmCustomEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </label>
                {(crmCustomStartDate || crmCustomEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCrmCustomStartDate('');
                      setCrmCustomEndDate('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                  >
                    Limpar datas
                  </button>
                )}
              </div>
            )}

            {/* Row 2: Seller Filter + Search Input */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCrmSellerFilter('todos')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    crmSellerFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos os Vendedores (
                  {
                    leads.filter((l) =>
                      matchesLeadDateFilter(
                        l,
                        crmDateFilter,
                        crmCustomStartDate,
                        crmCustomEndDate
                      )
                    ).length
                  }
                  )
                </button>
                {sellers.map((s) => {
                  const count = leads.filter(
                    (l) =>
                      l.sellerId === s.id &&
                      matchesLeadDateFilter(
                        l,
                        crmDateFilter,
                        crmCustomStartDate,
                        crmCustomEndDate
                      )
                  ).length;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCrmSellerFilter(s.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        crmSellerFilter === s.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s.name}
                      {s.active === false ? ' (Inativo)' : ''} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  placeholder="Buscar por nome ou telefone do cliente..."
                  aria-label="Buscar leads por nome ou telefone do cliente"
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
                />
                {crmSearch && (
                  <button
                    type="button"
                    onClick={() => setCrmSearch('')}
                    title="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main 2-Column Split: Leads Table (Left 7 cols) + Lead Product Views Inspector (Right 5 cols) */}
          {filteredLeads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-3 stroke-[1.5]" />
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                Nenhum lead encontrado para o período selecionado
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                {crmDateFilter !== 'todos' ||
                crmSellerFilter !== 'todos' ||
                Boolean(crmSearch.trim())
                  ? 'Não há leads capturados que correspondam aos filtros atuais de data, vendedor ou busca. Você pode exibir todos os períodos ou simular um novo cadastro.'
                  : 'Quando um cliente abre o link enviado pelo vendedor e informa nome e telefone, o cadastro fica salvo automaticamente no banco de dados com todos os equipamentos visualizados.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(crmDateFilter !== 'todos' ||
                  crmSellerFilter !== 'todos' ||
                  Boolean(crmSearch.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCrmDateFilter('todos');
                      setCrmCustomStartDate('');
                      setCrmCustomEndDate('');
                      setCrmSellerFilter('todos');
                      setCrmSearch('');
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Ver Todos os Períodos ({leads.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('catalogo')}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Simular Cadastro de Cliente no Catálogo
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Cols: High-Density Leads List */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        filteredLeads.length > 0 &&
                        selectedFilteredLeads.length === filteredLeads.length
                      }
                      onChange={toggleSelectAllFilteredLeadsForPdf}
                      title="Selecionar ou desmarcar todos os leads da lista para exportar em PDF"
                      className="w-4 h-4 accent-red-700 rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-900">
                      Relação de Clientes (Leads) & Vendedor Responsável ({filteredLeads.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedFilteredLeads.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedLeadIdsForPdf([])}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline cursor-pointer"
                      >
                        Limpar seleção ({selectedFilteredLeads.length})
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={exportingLeadsPdf}
                      onClick={() => handleExportLeadsPdf()}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-red-400" />
                      <span>
                        {selectedFilteredLeads.length > 0
                          ? `Baixar PDF (${selectedFilteredLeads.length} selecionados)`
                          : `Baixar PDF (${filteredLeads.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Real-time quick search bar inside the Leads list panel */}
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={crmSearch}
                      onChange={(e) => setCrmSearch(e.target.value)}
                      placeholder="Filtrar lista em tempo real por nome ou telefone do cliente..."
                      aria-label="Filtrar lista de leads em tempo real por nome ou telefone do cliente"
                      className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                    />
                    {crmSearch && (
                      <button
                        type="button"
                        onClick={() => setCrmSearch('')}
                        title="Limpar filtro de busca"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {crmSearch.trim() && (
                    <div className="text-[11px] text-slate-600 font-medium whitespace-nowrap">
                      Exibindo <strong className="text-slate-900">{filteredLeads.length}</strong> de{' '}
                      <strong className="text-slate-900">{leads.length}</strong> leads
                    </div>
                  )}
                </div>

                <div className="divide-y divide-slate-200">
                  {filteredLeads.map((lead) => {
                    const isSelected = inspectedLead?.id === lead.id;
                    const isCheckedForPdf = selectedLeadIdsForPdf.includes(lead.id);
                    const leadViews = viewsByLead[lead.id] || [];

                    return (
                      <div
                        key={lead.id}
                        onClick={() => setInspectedLeadId(lead.id)}
                        className={`px-6 py-4 transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isCheckedForPdf}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleLeadSelectionForPdf(lead.id)}
                              title="Marcar este lead para exportação em PDF"
                              className="w-4 h-4 accent-red-700 rounded cursor-pointer shrink-0"
                            />
                            <span className="text-sm font-semibold text-slate-900">
                              {lead.clientName}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-xs font-mono-tabular text-slate-700">
                              {lead.clientPhone}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                            <span>{STATUS_LABELS[lead.status]}</span>
                            <span aria-hidden="true">·</span>
                            <span title="Data e horário de captura do lead">
                              {formatDateTime(lead.createdAt || lead.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pl-6.5">
                          <div>
                            <span>Vendedor que enviou o link: </span>
                            <strong className="text-slate-900 font-semibold">
                              {lead.sellerName}
                            </strong>
                          </div>

                          <div className="font-mono-tabular text-slate-800 font-medium">
                            {leadViews.length}{' '}
                            {leadViews.length === 1 ? 'equipamento visto' : 'equipamentos vistos'} (
                            {lead.totalViews} cliques)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Detailed Inspector of Products Viewed by Selected Lead */}
              {inspectedLead && (
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 lg:p-7 sticky top-24">
                  <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        Ficha do Lead · Capturado em{' '}
                        <span className="font-mono-tabular font-medium text-slate-700">
                          {formatDateTime(inspectedLead.createdAt || inspectedLead.updatedAt)}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 font-sans">
                        {inspectedLead.clientName}
                      </h2>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {inspectedLead.clientPhone}
                        </span>
                        <span aria-hidden="true">·</span>
                        <a
                          href={`https://wa.me/55${inspectedLead.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Olá ${inspectedLead.clientName}, aqui é ${inspectedLead.sellerName}! Vi que você consultou equipamentos em nosso catálogo e gostaria de enviar uma proposta.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-800 font-semibold underline hover:text-emerald-900"
                        >
                          Chamar no WhatsApp
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={exportingLeadsPdf}
                        onClick={() =>
                          handleExportLeadsPdf(
                            [inspectedLead],
                            `ficha-lead-${sanitizeId(inspectedLead.clientName)}`
                          )
                        }
                        title="Exportar ficha e visualizações deste cliente em PDF com logotipo"
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF da Ficha</span>
                      </button>

                      {canDeleteLeads && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLead(inspectedLead.id)}
                          title="Excluir Lead"
                          className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Seller Attribution Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
                    <div className="text-xs text-slate-500 mb-1">
                      Vendedor que enviou o link para este cliente
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {inspectedLead.sellerName}
                      </span>
                      <span className="text-xs font-mono-tabular text-slate-500">
                        ID: {inspectedLead.sellerId}
                      </span>
                    </div>
                  </div>

                  {/* Pipeline Stage Selector */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Estágio do Atendimento</span>
                      {inspectedLead.status === 'convertido' && (
                        <span className="text-emerald-800 font-medium">
                          Venda Concluída (Estado Final)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                      {(['novo', 'em_atendimento', 'proposta', 'convertido'] as LeadStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={
                              inspectedLead.status === 'convertido' && st !== 'convertido'
                            }
                            onClick={() => handleUpdateLeadStatus(inspectedLead, st)}
                            className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap truncate cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              inspectedLead.status === st
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {STATUS_LABELS[st]}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* List of Products Viewed by this Client */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Equipamentos Visualizados pelo Cliente (
                        {(viewsByLead[inspectedLead.id] || []).length})
                      </h3>
                      <span className="text-xs font-mono-tabular text-slate-500">
                        Total: {inspectedLead.totalViews} aberturas
                      </span>
                    </div>

                    {(viewsByLead[inspectedLead.id] || []).length === 0 ? (
                      <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-500 mb-3">
                          Este cliente cadastrou nome e telefone, mas ainda não abriu nenhum
                          equipamento específico.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.setItem('campos_equip_lead_id', inspectedLead.id);
                            setActiveLeadId(inspectedLead.id);
                            setActiveTab('catalogo');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Simular Visualização como {inspectedLead.clientName}
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                        {(viewsByLead[inspectedLead.id] || []).map((view) => (
                          <div
                            key={view.id}
                            className="p-3.5 bg-white flex items-center justify-between gap-3.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openImageLightbox(
                                    [view.productImage],
                                    0,
                                    view.productName,
                                    `${view.productCategory} · ${formatCurrency(view.productPrice)}`
                                  )
                                }
                                title="Clique para ampliar a foto do equipamento"
                                className="w-14 h-11 rounded-md overflow-hidden bg-white shrink-0 border border-slate-200 p-1 flex items-center justify-center cursor-zoom-in hover:border-red-700 transition-colors"
                              >
                                <SafeImage
                                  src={view.productImage}
                                  alt={view.productName}
                                  className="w-full h-full object-contain"
                                />
                              </button>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {view.productName}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <span>{view.productCategory}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono-tabular font-semibold text-slate-700">
                                    {formatCurrency(view.productPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-slate-900 font-mono-tabular">
                                {view.viewCount}x {view.viewCount === 1 ? 'visita' : 'visitas'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono-tabular">
                                {formatDateTime(view.updatedAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          VIEW 3: VENDEDORES & GERADOR DE LINKS RASTREÁVEIS
         ===================================================================== */}
      {activeTab === 'vendedores' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 mb-8 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span>Links Individuais de Rastreamento</span>
                <span aria-hidden="true">·</span>
                <span>Atribuição Automática de Leads por Vendedor</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight font-sans">
                Equipe de Vendedores & Links do Catálogo
              </h1>
            </div>

            {/* Seller Status Filter (Todos / Ativos / Inativos) */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setSellerStatusFilter('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sellerStatusFilter === 'todos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({sellers.length})
              </button>
              <button
                type="button"
                onClick={() => setSellerStatusFilter('ativos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sellerStatusFilter === 'ativos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ativos ({activeSellers.length})
              </button>
              <button
                type="button"
                onClick={() => setSellerStatusFilter('inativos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sellerStatusFilter === 'inativos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inativos ({sellers.length - activeSellers.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 8 Cols: Sellers List & Shareable Links */}
            <div className="lg:col-span-8 space-y-4">
              {filteredSellers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-3 stroke-[1.5]" />
                  <p className="text-base font-semibold text-slate-900 mb-1">
                    {sellers.length === 0
                      ? 'Nenhum vendedor cadastrado ainda'
                      : 'Nenhum vendedor encontrado neste filtro'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    {sellers.length === 0
                      ? 'Os vendedores de exemplo foram removidos. Utilize o formulário ao lado para cadastrar os vendedores reais da sua equipe e gerar seus links exclusivos.'
                      : 'Altere o filtro acima para visualizar vendedores ativos ou inativos.'}
                  </p>
                  {sellers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSellerStatusFilter('todos')}
                      className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Ver Todos os Vendedores
                    </button>
                  )}
                </div>
              ) : (
                filteredSellers.map((seller) => {
                  const isActive = seller.active !== false;
                  const chosenSegSlug = sellerSelectedSegment[seller.id] || '';
                  const chosenSegObj = displaySegments.find((s) => s.slug === chosenSegSlug);
                  const sellerUrl = buildShareableCatalogUrl(seller.id, chosenSegSlug || undefined);
                  const sellerLeads = leads.filter((l) => l.sellerId === seller.id);
                  const sellerViews = sellerLeads.reduce((acc, l) => acc + (l.totalViews || 0), 0);
                  const isCopied = copiedSellerId === seller.id;

                  return (
                    <div
                      key={seller.id}
                      className={`border rounded-2xl p-6 flex flex-col gap-4 transition-colors ${
                        isActive
                          ? 'bg-white border-slate-200/80'
                          : 'bg-slate-50/70 border-slate-200/60 opacity-80'
                      }`}
                    >
                      {/* Row 1: Seller Identity & KPI Metrics */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2
                              className={`text-lg font-bold font-sans ${
                                isActive ? 'text-slate-900' : 'text-slate-500 line-through'
                              }`}
                            >
                              {seller.name}
                            </h2>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-xs text-slate-500">{seller.roleTitle}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={`text-xs font-medium ${
                                isActive ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                            <span>
                              WhatsApp: <strong className="font-mono-tabular text-slate-800">{seller.whatsapp}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 text-right font-mono-tabular shrink-0">
                          <div>
                            <div className="text-[11px] text-slate-400 font-sans">Leads</div>
                            <div className="text-base font-bold text-slate-900">
                              {sellerLeads.length}
                            </div>
                          </div>
                          <div className="border-l border-slate-100 pl-5">
                            <div className="text-[11px] text-slate-400 font-sans">Vistos</div>
                            <div className="text-base font-bold text-slate-900">{sellerViews}</div>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Management Actions (Only shown if user has permission) */}
                      {(canManageSellers || isAdminAuthenticated) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3.5 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Gestão do vendedor e permissões de acesso</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {canManageSellers && (
                              <button
                                type="button"
                                onClick={() =>
                                  editingSellerId === seller.id
                                    ? setEditingSellerId(null)
                                    : startEditingSeller(seller)
                                }
                                className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3 text-slate-500" />
                                <span>{editingSellerId === seller.id ? 'Fechar' : 'Editar'}</span>
                              </button>
                            )}

                            {isAdminAuthenticated && (
                              <button
                                type="button"
                                onClick={() => setActiveTab('seguranca')}
                                className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Shield className="w-3 h-3 text-red-700" />
                                <span>Permissões (/staff)</span>
                              </button>
                            )}

                            {canManageSellers && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSellerActive(seller)}
                                  className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  {isActive ? 'Inativar' : 'Reativar'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSeller(seller)}
                                  title="Excluir vendedor"
                                  className="p-1 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Inline Edit Seller Form */}
                      {editingSellerId === seller.id && canManageSellers && (
                        <form
                          onSubmit={(e) => handleSaveSellerEdit(e, seller)}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                        >
                          <div className="text-xs font-semibold text-slate-900">
                            Alterar Dados de {seller.name}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Nome do Vendedor
                              </label>
                              <input
                                type="text"
                                required
                                value={editSellerName}
                                onChange={(e) => setEditSellerName(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Setor / Especialidade
                              </label>
                              <input
                                type="text"
                                required
                                value={editSellerRole}
                                onChange={(e) => setEditSellerRole(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Telefone / WhatsApp Comercial
                              </label>
                              <input
                                type="tel"
                                required
                                value={editSellerWhatsapp}
                                onChange={(e) => setEditSellerWhatsapp(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                              />
                            </div>
                          </div>
                          {editSellerError && (
                            <p className="text-xs text-red-700 font-medium">{editSellerError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSellerId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Salvar Alterações
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Row 3: Segment Selector & Shareable Catalog Link Actions */}
                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        {isActive && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-xs text-slate-500">
                              Segmento do link para o cliente:
                            </label>
                            <select
                              value={chosenSegSlug}
                              onChange={(e) =>
                                setSellerSelectedSegment((prev) => ({
                                  ...prev,
                                  [seller.id]: e.target.value,
                                }))
                              }
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400"
                            >
                              <option value="">Catálogo Completo (Todos os Segmentos)</option>
                              {displaySegments.map((seg) => {
                                const count = displayProducts.filter((p) =>
                                  productBelongsToSegment(p, seg.name)
                                ).length;
                                return (
                                  <option key={seg.id} value={seg.slug}>
                                    {seg.name} ({count} itens)
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div
                            className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-mono-tabular ${
                              isActive
                                ? 'bg-slate-50/70 border-slate-200/80 text-slate-600'
                                : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}
                          >
                            <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {isActive ? (
                              <input
                                type="text"
                                readOnly
                                value={sellerUrl}
                                onClick={(e) => e.currentTarget.select()}
                                title="Clique para selecionar o link"
                                className="w-full bg-transparent text-xs font-mono-tabular text-slate-600 focus:outline-none cursor-pointer"
                              />
                            ) : (
                              <span className="truncate">
                                {`Link pausado (${seller.name} está inativo)`}
                              </span>
                            )}
                          </div>

                          {isActive && (
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  copySellerCatalogUrl(seller, chosenSegSlug || undefined)
                                }
                                className="px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar Link</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `Olá! Confira nosso catálogo de equipamentos${
                                    chosenSegObj ? ` (${chosenSegObj.name})` : ''
                                  } enviado por ${seller.name}: ${sellerUrl}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 text-xs font-medium bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => {
                                  selectSellerLink(seller);
                                  selectSegmentCatalog(chosenSegSlug);
                                  localStorage.removeItem('campos_equip_lead_id');
                                  setActiveLeadId(null);
                                  setPendingSessionViews([]);
                                  setClientNameInput('');
                                  setClientPhoneInput('');
                                  setClientStep('welcome');
                                  setIsClientMode(true);
                                }}
                                className="px-3 py-2 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Testar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right 4 Cols: Form to Register New Seller (Only shown if canManageSellers) */}
            {canManageSellers && (
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-lg font-bold text-slate-900 font-sans">
                    Cadastrar Novo Vendedor
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-5">
                  Cadastre o vendedor para gerar seu link rastreável do catálogo. Para liberar o
                  acesso dele ao painel interno, vincule o e-mail dele na aba{' '}
                  <strong>Permissões</strong>.
                </p>

                <form onSubmit={handleAddSeller} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nome do Vendedor
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Marcos Oliveira"
                      value={newSellerName}
                      onChange={(e) => setNewSellerName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Setor / Especialidade
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Vendas Externas — Refrigeração"
                      value={newSellerRole}
                      onChange={(e) => setNewSellerRole(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Telefone / WhatsApp Comercial
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: (11) 99876-5432"
                      value={newSellerWhatsapp}
                      onChange={(e) => setNewSellerWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  {sellerFormError && (
                    <p className="text-xs text-red-700 font-medium">{sellerFormError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors cursor-pointer"
                  >
                    Criar Vendedor & Gerar Link
                  </button>
                </form>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          VIEW 4: GESTÃO DE PRODUTOS E SEGMENTOS DO CATÁLOGO
         ===================================================================== */}
      {activeTab === 'produtos' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-8 mb-8 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                <span>Gestão de Catálogo</span>
                <span aria-hidden="true">·</span>
                <span>Tabela PB-10X</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-sans">
                Equipamentos & Segmentos ({displayProducts.length})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdminAuthenticated && canViewPdfTable && (
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-2 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-red-700" />
                  <span>Tabela PDF (Admin)</span>
                </button>
              )}

              {(canManagePhotos || canEditProducts) && (
                <button
                  type="button"
                  disabled={isSeeding}
                  onClick={handleSyncAllProductPhotosFromMetadata}
                  className="px-3 py-2 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Camera className={`w-3.5 h-3.5 text-red-700 ${isSeeding ? 'animate-pulse' : ''}`} />
                  <span>Gerar Fotos Automáticas</span>
                </button>
              )}

              {isAdminAuthenticated && (
                <button
                  type="button"
                  disabled={isSeeding}
                  onClick={() => setShowResetCatalogConfirmModal(true)}
                  className="px-3 py-2 text-xs font-medium border border-red-200 bg-white text-red-700 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-red-700 ${isSeeding ? 'animate-spin' : ''}`} />
                  <span>Recarregar Produtos / Resetar Catálogo</span>
                </button>
              )}

              {canManageSegments && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSegmentId(null);
                    setNewSegmentName('');
                    setNewSegmentDesc('');
                    setNewSegmentCover(IMG_REFRIGERACAO);
                    setShowNewSegmentForm((v) => !v);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold border border-slate-900 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showNewSegmentForm ? 'Fechar Segmento' : 'Novo Segmento'}</span>
                </button>
              )}

              {canCreateOrDeleteProducts && (
                <button
                  type="button"
                  onClick={() => setShowNewProductForm((v) => !v)}
                  className="px-3.5 py-2 text-xs font-semibold bg-red-700 text-white rounded-xl hover:bg-red-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showNewProductForm ? 'Fechar Formulário' : 'Novo Equipamento'}</span>
                </button>
              )}
            </div>
          </div>

          {/* New / Edit Segment Creation Form */}
          {showNewSegmentForm && (
            <form
              onSubmit={handleAddSegment}
              className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 mb-8 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-sans">
                    {editingSegmentId
                      ? 'Editar Segmento de Produtos'
                      : 'Criar Novo Segmento de Produtos (Catálogo por Segmento)'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cada segmento criado pode ser marcado nos produtos e escolhido pelos vendedores
                    para virar um catálogo exclusivo ao enviar para um cliente/lead.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Segmento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pizzarias & Hamburguerias"
                    value={newSegmentName}
                    onChange={(e) => setNewSegmentName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Descrição Comercial do Catálogo deste Segmento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fornos, masseiras, chapas e refrigeração para pizzarias e lanchonetes."
                    value={newSegmentDesc}
                    onChange={(e) => setNewSegmentDesc(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <label className="block text-xs font-medium text-slate-700">
                    Imagem de Capa do Catálogo deste Segmento
                  </label>
                  <div>
                    <input
                      ref={newSegmentPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleNewSegmentPhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => newSegmentPhotoInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Enviar Capa do Computador / Celular</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {PRESET_GALLERY_OPTIONS.map((opt) => (
                    <button
                      key={opt.url}
                      type="button"
                      onClick={() => setNewSegmentCover(opt.url)}
                      className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                        newSegmentCover === opt.url
                          ? 'border-slate-900 bg-slate-100'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="aspect-[4/3] rounded overflow-hidden mb-1">
                        <SafeImage
                          src={opt.url}
                          alt={opt.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-[10px] font-medium text-slate-700 truncate">
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {segmentFormError && (
                <p className="text-xs text-red-700 font-medium">{segmentFormError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSegmentForm(false);
                    setEditingSegmentId(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors cursor-pointer"
                >
                  {editingSegmentId ? 'Salvar Alterações do Segmento' : 'Salvar Segmento'}
                </button>
              </div>
            </form>
          )}

          {/* Segment Catalogs Overview Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-sans">
                  Segmentos Cadastrados ({displaySegments.length}) — Transforme qualquer segmento em
                  um Catálogo
                </h2>
                <p className="text-xs text-slate-500">
                  Clique em &ldquo;Abrir Catálogo&rdquo; para visualizar apenas os produtos marcados
                  naquele segmento, em &ldquo;Editar&rdquo; para alterar o segmento ou em
                  &ldquo;Copiar Link&rdquo; para enviar ao cliente.
                </p>
              </div>

              {canManageSegments && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSegmentId(null);
                    setNewSegmentName('');
                    setNewSegmentDesc('');
                    setNewSegmentCover(IMG_REFRIGERACAO);
                    setShowNewSegmentForm(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-red-700" />
                  <span>Criar Segmento</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displaySegments.map((seg) => {
                const count = displayProducts.filter((p) =>
                  productBelongsToSegment(p, seg.name)
                ).length;
                const isCopied = copiedCatalogKey === seg.id;

                return (
                  <div
                    key={seg.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                        <SafeImage
                          src={seg.coverImage}
                          alt={seg.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-900 truncate">{seg.name}</h3>
                          <span className="text-[11px] font-mono-tabular font-semibold text-slate-600 shrink-0">
                            {count} itens
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {seg.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            selectSegmentCatalog(seg.slug);
                            setActiveTab('catalogo');
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-300 text-slate-800 rounded-md hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Abrir Catálogo
                        </button>
                        <button
                          type="button"
                          onClick={() => copySegmentCatalogUrl(seg, currentSeller.id)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>
                      </div>

                      {canManageSegments && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditSegmentForm(seg)}
                            title="Editar este segmento"
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {segments.some((s) => s.id === seg.id) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSegment(seg)}
                              title="Excluir segmento"
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Product Collapsible Form */}
          {showNewProductForm && (
            <form
              onSubmit={handleAddProduct}
              className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 mb-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900 font-sans">
                  Adicionar Equipamento ao Banco de Dados
                </h2>
                <span className="text-xs text-slate-500">
                  Suporta até 6 fotos por equipamento
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Equipamento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CILINDRO LAMINADOR CL390 220V G PANIZ"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Código do Produto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 188118"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Referência do Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CL390-90185"
                    value={newProdManufacturerRef}
                    onChange={(e) => setNewProdManufacturerRef(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preço PB-10X (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 10785.00"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Especificações Técnicas / Dimensões / Voltagem
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rolos 390mm · 220V · NR12"
                    value={newProdDimensions}
                    onChange={(e) => setNewProdDimensions(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fabricante & Acabamento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fabricante: G PANIZ · Aço Inox"
                    value={newProdMaterial}
                    onChange={(e) => setNewProdMaterial(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Mark which Segment(s) the New Product belongs to */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-900">
                      Marque a qual(is) Segmento(s) este produto pertence
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Você pode marcar 1 ou mais segmentos para que o produto apareça nos catálogos
                      correspondentes.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {displaySegments.map((seg) => {
                    const isChecked = newProdSegments.some(
                      (s) => s.toLowerCase() === seg.name.toLowerCase()
                    );
                    return (
                      <label
                        key={seg.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-red-50/70 border-red-700 text-slate-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setNewProdSegments((prev) => {
                              const exists = prev.some(
                                (s) => s.toLowerCase() === seg.name.toLowerCase()
                              );
                              if (exists) {
                                return prev.length > 1
                                  ? prev.filter(
                                      (s) => s.toLowerCase() !== seg.name.toLowerCase()
                                    )
                                  : prev;
                              }
                              return [...prev, seg.name];
                            });
                          }}
                          className="w-4 h-4 accent-red-700 rounded cursor-pointer"
                        />
                        <span className="truncate">{seg.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Descrição Comercial e Técnica
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva a capacidade, potência do motor, voltagem e aplicação do equipamento..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <label className="block text-xs font-medium text-slate-700">
                    Foto do Equipamento (envie do seu dispositivo ou escolha uma ilustração)
                  </label>
                  <div>
                    <input
                      ref={newProductPhotoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleNewProductPhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => newProductPhotoInputRef.current?.click()}
                      className="px-3.5 py-2 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Enviar Foto(s) do Computador / Celular</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3">
                  {PRESET_GALLERY_OPTIONS.map((opt) => (
                    <button
                      key={opt.url}
                      type="button"
                      onClick={() => setNewProdPrimaryImg(opt.url)}
                      className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                        newProdPrimaryImg === opt.url
                          ? 'border-slate-900 bg-slate-100'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="aspect-[4/3] rounded overflow-hidden bg-white p-1 mb-1 flex items-center justify-center">
                        <SafeImage
                          src={opt.url}
                          alt={opt.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[10px] font-medium text-slate-700 truncate">
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>

                {newProdPrimaryImg && (
                  <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          openImageLightbox(
                            [newProdPrimaryImg, ...newProdExtraImgs],
                            0,
                            newProdName || 'Pré-visualização do Equipamento',
                            newProdSku ? `Cód: ${newProdSku}` : undefined
                          )
                        }
                        title="Clique para expandir a imagem"
                        className="w-24 aspect-[4/3] rounded-lg overflow-hidden bg-white border border-slate-200 p-1.5 shrink-0 flex items-center justify-center cursor-zoom-in hover:border-red-700 transition-colors"
                      >
                        <SafeImage
                          src={newProdPrimaryImg}
                          alt="Pré-visualização"
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900">
                          Pré-visualização adaptada ao quadro (4:3)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Clique na miniatura ao lado para expandir em tela cheia.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  value={newProdPrimaryImg}
                  onChange={(e) => setNewProdPrimaryImg(e.target.value)}
                  placeholder="Caminho ou URL da imagem principal"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                />
              </div>

              {prodFormError && (
                <p className="text-xs text-red-700 font-medium">{prodFormError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewProductForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors cursor-pointer"
                >
                  Salvar Equipamento no Catálogo
                </button>
              </div>
            </form>
          )}

          {/* Products Table with Inline Segment Checkboxes and Full Registration Edit Button */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {displayProducts.map((prod) => {
                const prodSegs = parseProductSegments(prod.category);
                const { productCode, manufacturerRef, cleanDimensions } =
                  parseProductCodeAndRef(prod);

                return (
                  <div
                    key={prod.id}
                    className="p-5 flex flex-col gap-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() => openProductLightbox(prod, 0)}
                          title="Clique para ampliar a foto do equipamento"
                          className="w-18 h-14 rounded-xl overflow-hidden bg-white border border-slate-200/80 p-1 shrink-0 flex items-center justify-center cursor-zoom-in hover:border-red-700 transition-colors"
                        >
                          <SafeImage
                            src={prod.primaryImage}
                            alt={prod.name}
                            className="w-full h-full object-contain"
                          />
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono-tabular mb-1">
                            <span className="text-slate-700 font-semibold">
                              Cód: {productCode}
                            </span>
                            {manufacturerRef && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Ref: {manufacturerRef}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{prod.galleryImages.length} fotos</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-sans font-medium ${
                                prod.inStock ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {prod.inStock ? 'Em Estoque' : 'Sob Encomenda'}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 font-sans truncate">
                            {prod.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {prod.material} · {cleanDimensions}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 shrink-0">
                        <div className="text-left lg:text-right">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">PB-10X</div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 font-mono-tabular">
                            {formatCurrency(prod.price)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {canEditProducts && (
                            <button
                              type="button"
                              onClick={(e) => openProductEditModal(prod, e)}
                              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}

                          {canManagePhotos && (
                            <button
                              type="button"
                              onClick={(e) => openProductPhotoModal(prod, e)}
                              className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-red-700" />
                              <span>Foto</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleInspectProduct(prod)}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Ver Ficha
                          </button>

                          {canEditProducts && (
                            <button
                              type="button"
                              onClick={() => handleToggleProductStock(prod)}
                              className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Estoque
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Checkboxes to mark which Segment(s) this product belongs to */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>Segmentos:</span>
                      </span>

                      {displaySegments.map((seg) => {
                        const isMarked = prodSegs.some(
                          (s) => s.toLowerCase() === seg.name.toLowerCase()
                        );
                        return (
                          <label
                            key={seg.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                              canEditProducts && canManageSegments
                                ? 'cursor-pointer'
                                : 'opacity-75 cursor-not-allowed'
                            } ${
                              isMarked
                                ? 'bg-red-50/70 border-red-200 text-red-900 font-medium'
                                : 'bg-white border-slate-200/70 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isMarked}
                              disabled={!canEditProducts || !canManageSegments}
                              onChange={() =>
                                handleToggleProductSegmentMembership(prod, seg.name)
                              }
                              className="w-3 h-3 accent-red-700 rounded cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span>{seg.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {!isClientMode && isAdminAuthenticated && activeTab === 'seguranca' && (
        <SecurityTabView
          isAdminAuthenticated={isAdminAuthenticated}
          adminEmail={authUserEmail || ADMIN_OWNER_EMAIL}
          sellers={sellers}
          staffMembers={staffMembers}
          onSaveStaffMember={handleSaveStaffMember}
          onToggleStaffPermission={handleToggleStaffPermission}
          onSetStaffPermissionPreset={handleSetStaffPermissionPreset}
          onToggleStaffActive={handleToggleStaffActive}
          onDeleteStaffMember={handleDeleteStaffMember}
          permissions={permissions}
          permSaveMessage={permissionSaveToast}
          permSaveError={permissionSaveError}
          handleTogglePermissionKey={handleTogglePermissionKey}
          savePermissionsDocument={savePermissionsDocument}
          handleAdminLogout={handleAdminLogout}
          appPublicUrl={
            window.location.origin.replace('//ais-dev-', '//ais-pre-') + window.location.pathname
          }
        />
      )}
        </>
      )}

      {/* =====================================================================
          MODAL 0: COMPANY LOGO UPLOAD / CONFIGURATION (TOP HEADER SLOT)
         ===================================================================== */}
      {showLogoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowLogoModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 lg:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  Identidade Visual no Topo da Página
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-sans">
                  Logomarca da Empresa
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Logo Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex flex-col items-center justify-center">
              <span className="text-[11px] text-slate-400 mb-2">Pré-visualização atual</span>
              <img
                src={companyLogoUrl}
                alt="Logomarca Atual"
                className="max-h-16 w-auto object-contain"
              />
            </div>

            {/* Option 1: Upload Image File from Computer */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-800 mb-2">
                Opção 1: Enviar arquivo de imagem do seu computador/celular
              </label>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={logoSaving}
                onClick={() => logoFileInputRef.current?.click()}
                className="w-full py-3 px-4 border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-red-700" />
                <span>{logoSaving ? 'Salvando no banco...' : 'Selecionar Imagem da Logomarca'}</span>
              </button>
            </div>

            {/* Option 2: Paste Image URL */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCompanyLogoToDatabase(logoUrlInput);
              }}
              className="space-y-3 pt-4 border-t border-slate-200"
            >
              <label className="block text-xs font-semibold text-slate-800">
                Opção 2: Informar link (URL) da logomarca
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/minha-logo.png"
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />

              {logoError && <p className="text-xs text-red-700 font-medium">{logoError}</p>}

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={logoSaving}
                  onClick={() => saveCompanyLogoToDatabase(DEFAULT_COMPANY_LOGO)}
                  className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Restaurar logo padrão
                </button>
                <button
                  type="submit"
                  disabled={logoSaving || !logoUrlInput.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Salvar Link da Logo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: PRODUCT DETAIL & MULTI-PHOTO GALLERY (PDP)
         ===================================================================== */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 lg:p-8 overflow-y-auto"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left 7 Cols: Interactive Multi-Photo Gallery */}
              <div className="lg:col-span-7 bg-slate-100 p-6 flex flex-col justify-between">
                <div
                  onClick={() => openProductLightbox(selectedProduct, activeGalleryIndex)}
                  title="Clique na imagem para ampliar em tela cheia"
                  className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-white border border-slate-200 mb-4 p-3 flex items-center justify-center cursor-zoom-in group"
                >
                  <SafeImage
                    src={
                      selectedProduct.galleryImages[activeGalleryIndex] ||
                      selectedProduct.primaryImage
                    }
                    alt={`${selectedProduct.name} - Imagem ${activeGalleryIndex + 1}`}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProductLightbox(selectedProduct, activeGalleryIndex);
                    }}
                    className="absolute bottom-3 right-3 z-10 px-3 py-1.5 text-xs font-semibold bg-slate-900/85 text-white rounded-lg shadow-xs hover:bg-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Clique para Ampliar</span>
                  </button>

                  {!isClientMode && (
                    <>
                      {canEditProducts && (
                        <button
                          type="button"
                          onClick={(e) => openProductEditModal(selectedProduct, e)}
                          className="absolute top-3 left-3 z-10 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white border border-slate-900 rounded-lg shadow-sm hover:bg-red-700 hover:border-red-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar Cadastro</span>
                        </button>
                      )}

                      {canManagePhotos && (
                        <button
                          type="button"
                          onClick={(e) => openProductPhotoModal(selectedProduct, e)}
                          className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs font-semibold bg-white/95 text-slate-900 border border-slate-300 rounded-lg shadow-sm hover:bg-slate-900 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Incluir Foto</span>
                        </button>
                      )}
                    </>
                  )}

                  {selectedProduct.galleryImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveGalleryIndex((prev) =>
                            prev === 0
                              ? selectedProduct.galleryImages.length - 1
                              : prev - 1
                          );
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-900 border border-slate-200 flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                        aria-label="Imagem anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveGalleryIndex((prev) =>
                            prev === selectedProduct.galleryImages.length - 1
                              ? 0
                              : prev + 1
                          );
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-900 border border-slate-200 flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                        aria-label="Próxima imagem"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails Strip */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {selectedProduct.galleryImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveGalleryIndex(idx)}
                      onDoubleClick={() => openProductLightbox(selectedProduct, idx)}
                      title="Clique para ver ou clique duas vezes para ampliar"
                      className={`w-20 aspect-[4/3] rounded-lg overflow-hidden bg-white p-1 border-2 shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                        activeGalleryIndex === idx
                          ? 'border-red-700 opacity-100'
                          : 'border-transparent opacity-65 hover:opacity-100'
                      }`}
                    >
                      <SafeImage
                        src={imgUrl}
                        alt={`Miniatura ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}

                  {!isClientMode && canManagePhotos && (
                    <button
                      type="button"
                      onClick={(e) => openProductPhotoModal(selectedProduct, e)}
                      className="w-20 aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-900 bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 flex flex-col items-center justify-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-semibold">Nova Foto</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Contiguous Product Spec & Lead Tracking Status */}
              <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col justify-between">
                {(() => {
                  const { productCode, manufacturerRef, cleanDimensions } =
                    parseProductCodeAndRef(selectedProduct);
                  return (
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="uppercase tracking-wider text-red-700 font-semibold">
                            {parseProductSegments(selectedProduct.category).join(' · ')}
                          </span>
                          {showProductCodeInCatalog && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono-tabular font-semibold text-slate-800">
                                Cód: {productCode}
                              </span>
                            </>
                          )}
                          {showManufacturerRefInCatalog && manufacturerRef && (
                            <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 font-mono-tabular font-medium text-slate-600">
                              Ref. Fab: {manufacturerRef}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                          aria-label="Fechar"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-3 font-sans leading-snug">
                        {selectedProduct.name}
                      </h2>

                      <div className="mb-4 flex items-center justify-between gap-3">
                        {showPricesInCatalog ? (
                          <div>
                            <div className="text-xs text-slate-500">Valor Tabela PB-10X</div>
                            <div className="text-2xl font-bold text-slate-900 font-mono-tabular">
                              {formatCurrency(selectedProduct.price)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-slate-500">Valor Comercial</div>
                            <div className="text-base font-bold text-slate-700">
                              Preço sob consulta com {currentSeller.name}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => toggleFavoriteProduct(selectedProduct, e)}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                              favoriteProductIds.includes(selectedProduct.id)
                                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                favoriteProductIds.includes(selectedProduct.id)
                                  ? 'fill-red-600 text-red-600'
                                  : 'text-slate-500'
                              }`}
                            />
                            <span>
                              {favoriteProductIds.includes(selectedProduct.id)
                                ? 'Salvo nos Favoritos'
                                : 'Favoritar'}
                            </span>
                          </button>

                          {!isClientMode && canEditProducts && (
                            <button
                              type="button"
                              onClick={(e) => openProductEditModal(selectedProduct, e)}
                              className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar Cadastro</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        {selectedProduct.description}
                      </p>

                      <div className="space-y-2.5 pt-4 border-t border-slate-200 text-xs mb-6">
                        {showProductCodeInCatalog && (
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Código do Produto:</span>
                            <span className="font-semibold text-slate-900 font-mono-tabular">
                              {productCode}
                            </span>
                          </div>
                        )}
                        {showManufacturerRefInCatalog && (
                          <div className="flex justify-between py-1 border-t border-slate-100">
                            <span className="text-slate-500">Referência do Fabricante:</span>
                            <span className="font-semibold text-slate-900 font-mono-tabular">
                              {manufacturerRef || 'Não informada'}
                            </span>
                          </div>
                        )}
                        {showDimensionsInCatalog && (
                          <>
                            <div className="flex justify-between py-1 border-t border-slate-100">
                              <span className="text-slate-500">Especificações / Dimensões:</span>
                              <span className="font-medium text-slate-900 font-mono-tabular text-right">
                                {cleanDimensions}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-t border-slate-100">
                              <span className="text-slate-500">Fabricante / Construção:</span>
                              <span className="font-medium text-slate-900 text-right">
                                {selectedProduct.material}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between py-1 border-t border-slate-100">
                          <span className="text-slate-500">Vendedor Responsável:</span>
                          <span className="font-semibold text-slate-900">
                            {currentSeller.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tracking Feedback or Quick Identification Prompt */}
                <div className="pt-4 border-t border-slate-200">
                  {currentActiveLead ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700 flex items-center justify-between">
                        <span>
                          Visualização salva para{' '}
                          <strong className="text-slate-900">
                            {currentActiveLead.clientName}
                          </strong>
                        </span>
                        <Eye className="w-4 h-4 text-emerald-700 shrink-0" />
                      </div>
                      {showWhatsappInCatalog && (
                        <a
                          href={`https://wa.me/55${currentSeller.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Olá ${currentSeller.name}, meu nome é ${currentActiveLead.clientName}. Vi no catálogo o equipamento "${selectedProduct.name}" (${selectedProduct.sku}${showPricesInCatalog ? ` - ${formatCurrency(selectedProduct.price)}` : ''}) e gostaria de negociar.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Negociar Equipamento com {currentSeller.name}</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        Informe seu nome e telefone para registrar interesse neste equipamento com{' '}
                        <strong>{currentSeller.name}</strong>:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingProductToOpen(selectedProduct);
                          setSelectedProduct(null);
                          setShowLeadModal(true);
                        }}
                        className="w-full py-3 px-4 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors cursor-pointer"
                      >
                        Informar Nome e Telefone para Cotação
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CLIENT LEAD IDENTIFICATION MODAL
         ===================================================================== */}
      {showLeadModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowLeadModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 lg:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
              <img
                src={companyLogoUrl}
                alt="Logomarca da Empresa"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                }}
                className="max-h-10 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setShowLeadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">
                Vendedor responsável: {currentSeller.name}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-sans">
                Identificação do Cliente
              </h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Informe seu nome e telefone (opcional) para atendimento com{' '}
              <strong>{currentSeller.name}</strong> ou clique abaixo para continuar.
            </p>

            <form onSubmit={handleCreateClientLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seu Nome ou Nome da Empresa (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Padaria Estrela / João Silva"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Telefone / WhatsApp com DDD (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: (11) 99402-1188"
                  value={clientPhoneInput}
                  onChange={(e) => setClientPhoneInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                />
              </div>

              {leadFormError && (
                <p className="text-xs text-red-700 font-medium">{leadFormError}</p>
              )}

              <button
                type="submit"
                disabled={leadSubmitting}
                className="w-full py-3 px-4 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {leadSubmitting ? 'Abrindo Catálogo...' : 'Confirmar e Abrir Catálogo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: PRIVATE PDF PRICE TABLE NOTICE (ADMIN ONLY)
         ===================================================================== */}
      {showPdfModal && isAdminAuthenticated && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 lg:p-8"
          onClick={() => setShowPdfModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 lg:p-8 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={companyLogoUrl}
                  alt="Logomarca da Empresa"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
                  }}
                  className="h-8 w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 font-sans truncate">
                    Tabela de Preços em PDF (Acesso Restrito ao Administrador)
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Proteção de arquivo interno
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Acesso público ao PDF foi removido por segurança</span>
                </div>
                <p>
                  O arquivo <code className="font-mono">Tabela_de_Pre_os_Equipamentos_22999eec.pdf</code> foi
                  excluído da pasta pública (<code className="font-mono">public/assets/aistudio/</code>) para impedir que
                  visitantes ou terceiros baixem a tabela completa de preços pelo endereço direto.
                </p>
              </div>
              <p>
                Para disponibilizar o PDF exclusivamente ao administrador, envie o arquivo manualmente para a
                pasta privada <code className="font-mono">private/</code> em um bucket privado do Supabase Storage do seu projeto.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3B: CONFIRM CATALOG RESET (ADMIN ONLY)
         ===================================================================== */}
      {showResetCatalogConfirmModal && isAdminAuthenticated && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowResetCatalogConfirmModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 lg:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                  Ação Exclusiva do Administrador
                </span>
                <h2 className="text-lg font-bold text-slate-900 font-sans mt-0.5">
                  Recarregar Produtos / Resetar Catálogo
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowResetCatalogConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed mb-6">
              <p className="font-bold mb-1">Atenção: isso apaga todos os produtos atuais!</p>
              <p>
                Ao confirmar, todos os equipamentos cadastrados atualmente no banco de dados serão apagados e
                substituídos pela lista inicial do catálogo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetCatalogConfirmModal(false)}
                className="px-4 py-2.5 text-xs font-semibold border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSeeding}
                onClick={async () => {
                  setShowResetCatalogConfirmModal(false);
                  await syncCamposCatalogToFirestore(true);
                }}
                className="px-4 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-xl hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Sim, apagar todos os produtos atuais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4 (TOP PRIORITY): PRODUCT PHOTO UPLOAD & GALLERY MANAGER MODAL
         ===================================================================== */}
      {photoModalProduct && (
        <div
          style={{ zIndex: 9998 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPhotoModalProduct(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 lg:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs text-slate-500 mb-0.5 font-mono-tabular">
                  {photoModalProduct.sku}
                </div>
                <h2 className="text-lg font-bold text-slate-900 font-sans leading-snug">
                  Incluir / Gerenciar Fotos — {photoModalProduct.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector: Replace Main Cover vs Add to Gallery */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => setPhotoUploadMode('replace_cover')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  photoUploadMode === 'replace_cover'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Definir como Foto Principal (Capa)
              </button>
              <button
                type="button"
                onClick={() => setPhotoUploadMode('add_gallery')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  photoUploadMode === 'add_gallery'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Adicionar na Galeria ({photoModalProduct.galleryImages.length}/6)
              </button>
            </div>

            {/* Upload File from Device */}
            <div className="mb-4">
              <input
                ref={productPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleProductPhotoFilesChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={photoSaving}
                onClick={() => productPhotoInputRef.current?.click()}
                className="w-full py-4 px-4 border-2 border-dashed border-red-300 hover:border-red-700 rounded-xl text-xs font-semibold text-slate-900 bg-red-50/40 hover:bg-red-50 transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-6 h-6 text-red-700" />
                <span>
                  {photoSaving
                    ? 'Enviando e salvando no banco de dados...'
                    : 'Clique aqui para enviar foto(s) do seu computador ou celular'}
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Compressão inteligente WebP HD (1280×960px) · Máxima nitidez com arquivo ultraleve
                </span>
              </button>
            </div>

            {photoCompressionReport && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{photoCompressionReport}</span>
              </div>
            )}

            {/* Auto-Generate Product Specific Photo from Name, Manufacturer & Reference */}
            <div className="mb-4">
              <button
                type="button"
                disabled={photoSaving}
                onClick={() => {
                  const autoPhoto = generateProductSpecificPhoto({
                    name: photoModalProduct.name,
                    sku: photoModalProduct.sku,
                    dimensions: photoModalProduct.dimensions,
                    material: photoModalProduct.material,
                    category: photoModalProduct.category,
                  });
                  applyPhotoToProduct(photoModalProduct, autoPhoto);
                }}
                className="w-full py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                <span>
                  Gerar Foto Automática por Nome, Fabricante e Referência ({photoModalProduct.sku})
                </span>
              </button>
            </div>

            {/* Paste Image URL */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyPhotoToProduct(photoModalProduct, photoUrlInput);
              }}
              className="flex items-center gap-2 mb-6"
            >
              <input
                type="text"
                placeholder="Ou cole o link (URL) de uma foto do produto..."
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
              <button
                type="submit"
                disabled={photoSaving || !photoUrlInput.trim()}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Incluir URL
              </button>
            </form>

            {photoError && (
              <p className="text-xs text-red-700 font-medium mb-4">{photoError}</p>
            )}

            {/* Current Gallery Grid */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
                <span className="font-semibold text-slate-800">
                  Fotos atuais deste equipamento ({photoModalProduct.galleryImages.length}/6)
                </span>
                <span>Clique na estrela para tornar capa</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {photoModalProduct.galleryImages.map((imgUrl, idx) => {
                  const isCover = photoModalProduct.primaryImage === imgUrl;
                  return (
                    <div
                      key={idx}
                      onClick={() => openProductLightbox(photoModalProduct, idx)}
                      title="Clique na foto para expandir em tela cheia"
                      className={`relative group rounded-xl overflow-hidden border-2 bg-white p-2 aspect-[4/3] flex items-center justify-center cursor-zoom-in ${
                        isCover ? 'border-red-700' : 'border-slate-200'
                      }`}
                    >
                      <SafeImage
                        src={imgUrl}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />

                      {isCover && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold bg-red-700 text-white rounded">
                          Capa Principal
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductLightbox(photoModalProduct, idx);
                        }}
                        title="Expandir foto em tela cheia"
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/75 text-white hover:bg-slate-900 transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {!isCover ? (
                          <button
                            type="button"
                            disabled={photoSaving}
                            onClick={() =>
                              handleSetGalleryImageAsCover(photoModalProduct, imgUrl)
                            }
                            className="px-2 py-1 text-[10px] font-semibold bg-white text-slate-900 rounded flex items-center gap-1 hover:bg-slate-100 cursor-pointer"
                          >
                            <Star className="w-3 h-3 text-amber-500" />
                            <span>Usar na Capa</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-white px-1">Foto principal</span>
                        )}

                        {photoModalProduct.galleryImages.length > 1 && (
                          <button
                            type="button"
                            disabled={photoSaving}
                            onClick={() =>
                              handleRemoveGalleryImage(photoModalProduct, imgUrl)
                            }
                            title="Remover esta foto"
                            className="p-1 text-red-300 hover:text-red-100 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPhotoModalProduct(null)}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5 (TOP PRIORITY): FULL PRODUCT REGISTRATION EDIT MODAL (EDITAR CADASTRO)
         ===================================================================== */}
      {editingProduct && (
        <div
          style={{ zIndex: 9999 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 lg:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500 mb-0.5 font-mono-tabular">
                  Alteração de Cadastro de Produto · ID: {editingProduct.id}
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-sans">
                  Editar Cadastro do Equipamento
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-5">
              {/* Row 1: Name, Product Code, Manufacturer Reference, Price */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Nome do Equipamento
                  </label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Código do Produto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 2994"
                    value={editProdSku}
                    onChange={(e) => setEditProdSku(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Referência do Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PAC220M60N5"
                    value={editProdManufacturerRef}
                    onChange={(e) => setEditProdManufacturerRef(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Preço PB-10X (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={!canEditPrices}
                    title={
                      !canEditPrices
                        ? 'O Administrador bloqueou a alteração de preços para vendedores'
                        : undefined
                    }
                    value={editProdPrice}
                    onChange={(e) => setEditProdPrice(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 2: Mark which Segment(s) this Product belongs to + Inline Create New Segment */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-900">
                      Marque a qual(is) Segmento(s) este produto pertence
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Marque 1 ou mais segmentos. O produto aparecerá automaticamente no catálogo de
                      cada segmento marcado.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {displaySegments.map((seg) => {
                    const isChecked = editProdSegments.some(
                      (s) => s.toLowerCase() === seg.name.toLowerCase()
                    );
                    return (
                      <label
                        key={seg.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-red-50 border-red-700 text-slate-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setEditProdSegments((prev) => {
                              const exists = prev.some(
                                (s) => s.toLowerCase() === seg.name.toLowerCase()
                              );
                              if (exists) {
                                return prev.length > 1
                                  ? prev.filter(
                                      (s) => s.toLowerCase() !== seg.name.toLowerCase()
                                    )
                                  : prev;
                              }
                              return [...prev, seg.name];
                            });
                          }}
                          className="w-4 h-4 accent-red-700 rounded cursor-pointer"
                        />
                        <span className="truncate">{seg.name}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Quick Create New Segment directly inside the Product Edit Modal */}
                {canManageSegments && (
                  <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Criar novo segmento agora (ex: Padarias & Confeitarias)..."
                      value={quickSegNameInModal}
                      onChange={(e) => setQuickSegNameInModal(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      disabled={quickSegSaving || quickSegNameInModal.trim().length < 2}
                      onClick={() =>
                        handleQuickCreateSegment(quickSegNameInModal, (createdName) => {
                          setEditProdSegments((prev) =>
                            prev.some((s) => s.toLowerCase() === createdName.toLowerCase())
                              ? prev
                              : [...prev, createdName]
                          );
                        })
                      }
                      className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Segmento & Marcar</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Row 3: Specs, Manufacturer, Stock Availability */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Especificações Técnicas / Dimensões / Voltagem
                  </label>
                  <input
                    type="text"
                    required
                    value={editProdDimensions}
                    onChange={(e) => setEditProdDimensions(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Fabricante & Acabamento
                  </label>
                  <input
                    type="text"
                    required
                    value={editProdMaterial}
                    onChange={(e) => setEditProdMaterial(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Disponibilidade
                  </label>
                  <select
                    value={editProdInStock ? 'estoque' : 'encomenda'}
                    onChange={(e) => setEditProdInStock(e.target.value === 'estoque')}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  >
                    <option value="estoque">Pronta Entrega / Estoque</option>
                    <option value="encomenda">Sob Encomenda</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Commercial & Technical Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Descrição Comercial e Técnica
                </label>
                <textarea
                  rows={3}
                  required
                  value={editProdDesc}
                  onChange={(e) => setEditProdDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Row 5: Photo & Gallery Quick Control */}
              {canManagePhotos && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openImageLightbox(
                            editProdGalleryImgs.length > 0
                              ? editProdGalleryImgs
                              : [editProdPrimaryImg],
                            0,
                            editProdName || 'Equipamento',
                            editProdSku ? `Cód: ${editProdSku}` : undefined
                          )
                        }
                        title="Clique para ampliar a foto em tela cheia"
                        className="w-16 h-12 rounded-lg overflow-hidden bg-white border border-slate-200 p-1 shrink-0 flex items-center justify-center cursor-zoom-in hover:border-red-700 transition-colors"
                      >
                        <SafeImage
                          src={editProdPrimaryImg}
                          alt={editProdName}
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Foto Principal & Galeria ({editProdGalleryImgs.length} fotos)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Envie uma nova foto do seu dispositivo ou informe a URL abaixo
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const combinedSku = formatSkuWithCodeAndRef(
                            editProdSku,
                            editProdManufacturerRef
                          );
                          const generated = buildProductGalleryFromMetadata({
                            name: editProdName,
                            sku: combinedSku,
                            dimensions: editProdDimensions,
                            material: editProdMaterial,
                            category: editProdSegments.join(' | '),
                          });
                          setEditProdPrimaryImg(generated.primaryImage);
                          setEditProdGalleryImgs(generated.galleryImages);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                        <span>Gerar Foto pelo Nome/Fabricante/Ref</span>
                      </button>

                      <input
                        ref={editProductPhotoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditProductPhotoFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => editProductPhotoInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Enviar Foto</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={editProdPrimaryImg}
                    onChange={(e) => setEditProdPrimaryImg(e.target.value)}
                    placeholder="URL ou caminho da foto principal"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />

                  {photoCompressionReport && (
                    <div className="mt-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{photoCompressionReport}</span>
                    </div>
                  )}
                </div>
              )}

              {editProdError && (
                <p className="text-xs text-red-700 font-medium">{editProdError}</p>
              )}

              {/* Footer Actions: Delete Product vs Cancel / Save Registration */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {canCreateOrDeleteProducts ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(editingProduct)}
                    className="px-3.5 py-2 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Equipamento</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    Exclusão restrita ao Administrador
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editProdSaving}
                    className="px-5 py-2.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {editProdSaving ? 'Salvando Alterações...' : 'Salvar Alterações no Cadastro'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: TEAM LOGIN MODAL (E-MAIL E SENHA)
         ===================================================================== */}
      <AdminLoginModal
        show={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        companyLogoUrl={companyLogoUrl}
        adminLoginError={adminLoginError}
      />
      <PasswordRecoveryOverlay />

      {/* =====================================================================
          MODAL 7: MOBILE APP INSTALLER (PWA — iOS & ANDROID)
         ===================================================================== */}
      <PWAInstallerModal
        show={showPWAInstallerModal}
        onClose={() => setShowPWAInstallerModal(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInIframe={isInIframe}
        onPromptInstall={promptInstall}
        appUrl={window.location.origin.replace('//ais-dev-', '//ais-pre-') + window.location.pathname}
        clientCatalogUrl={buildShareableCatalogUrl(
          currentSeller.id,
          currentSegmentCatalog?.slug
        )}
        sellerName={currentSeller.name}
        isClientMode={isClientMode}
      />

      {/* Automatic Floating Banner on iPhone / iPad (iOS) */}
      <IOSInstallPromptBanner
        isIOS={isIOS}
        isInstalled={isInstalled}
        onOpenIOSModal={() => setShowPWAInstallerModal(true)}
      />

      {/* =====================================================================
          MODAL 8: FULL-SCREEN IMAGE LIGHTBOX & ZOOM VIEWER
         ===================================================================== */}
      {lightboxState && (
        <div
          style={{ zIndex: 10000 }}
          className="fixed inset-0 bg-slate-950/92 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 select-none"
          onClick={() => setLightboxState(null)}
        >
          {/* Top Bar: Title, Counter, Zoom Controls & Close */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-white shadow-lg"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono-tabular">
                <span>
                  Foto {lightboxState.activeIndex + 1} de {lightboxState.images.length}
                </span>
                {lightboxState.subtitle && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-300 truncate">{lightboxState.subtitle}</span>
                  </>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate font-sans">
                {lightboxState.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() =>
                  setLightboxZoom((z) => (z > 1.75 ? 1.75 : 1))
                }
                disabled={lightboxZoom <= 1}
                title="Diminuir zoom"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Zoom Level Badge / Reset */}
              <button
                type="button"
                onClick={() =>
                  setLightboxZoom((z) => (z === 1 ? 1.75 : z === 1.75 ? 2.5 : 1))
                }
                title="Alternar nível de zoom (1x / 1.75x / 2.5x)"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular font-semibold text-white transition-colors cursor-pointer"
              >
                {Math.round(lightboxZoom * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() =>
                  setLightboxZoom((z) => (z < 1.75 ? 1.75 : 2.5))
                }
                disabled={lightboxZoom >= 2.5}
                title="Aumentar zoom"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Open full Product Spec Modal if not already open */}
              {lightboxState.product && !selectedProduct && (
                <button
                  type="button"
                  onClick={() => {
                    const prod = lightboxState.product!;
                    setLightboxState(null);
                    handleInspectProduct(prod);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <span>Ficha Técnica</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxState(null)}
                title="Fechar visualização (Esc)"
                className="p-2 rounded-xl bg-white/10 hover:bg-red-700 text-white transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Stage: Expanded Adaptive Image with Click-to-Zoom & Arrows */}
          <div className="relative flex-1 my-3 flex items-center justify-center overflow-auto">
            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom(1);
                  setLightboxState((prev) =>
                    prev
                      ? {
                          ...prev,
                          activeIndex:
                            prev.activeIndex === 0
                              ? prev.images.length - 1
                              : prev.activeIndex - 1,
                        }
                      : null
                  );
                }}
                aria-label="Foto anterior"
                className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/90 hover:bg-red-700 text-white border border-slate-700 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div
              onClick={(e) => {
                e.stopPropagation();
                setLightboxZoom((z) => (z === 1 ? 1.75 : z === 1.75 ? 2.5 : 1));
              }}
              title={
                lightboxZoom === 1
                  ? 'Clique na imagem para dar zoom (175%)'
                  : lightboxZoom === 1.75
                  ? 'Clique para zoom máximo (250%)'
                  : 'Clique para voltar ao tamanho padrão (100%)'
              }
              className={`bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200/20 flex items-center justify-center transition-transform duration-200 ${
                lightboxZoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              style={{
                maxWidth: lightboxZoom === 1 ? 'min(92vw, 1024px)' : 'none',
                maxHeight: lightboxZoom === 1 ? '74vh' : 'none',
                transform: `scale(${lightboxZoom})`,
                transformOrigin: 'center center',
              }}
            >
              <SafeImage
                src={lightboxState.images[lightboxState.activeIndex]}
                alt={`${lightboxState.title} - Foto ${lightboxState.activeIndex + 1}`}
                className="max-w-[84vw] sm:max-w-[880px] max-h-[68vh] w-auto h-auto object-contain"
              />
            </div>

            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom(1);
                  setLightboxState((prev) =>
                    prev
                      ? {
                          ...prev,
                          activeIndex:
                            prev.activeIndex === prev.images.length - 1
                              ? 0
                              : prev.activeIndex + 1,
                        }
                      : null
                  );
                }}
                aria-label="Próxima foto"
                className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/90 hover:bg-red-700 text-white border border-slate-700 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Strip: Thumbnails (if multiple images) + Helper Tip */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full mx-auto flex flex-col items-center gap-2.5"
          >
            {lightboxState.images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto max-w-full py-1 px-2 bg-slate-900/80 border border-slate-800 rounded-xl">
                {lightboxState.images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLightboxZoom(1);
                      setLightboxState((prev) =>
                        prev ? { ...prev, activeIndex: idx } : null
                      );
                    }}
                    className={`w-16 aspect-[4/3] rounded-lg overflow-hidden bg-white p-1 border-2 shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                      lightboxState.activeIndex === idx
                        ? 'border-red-600 scale-105 opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={imgUrl}
                      alt={`Miniatura ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="text-[11px] text-slate-400 text-center">
              Clique sobre a imagem para alternar o zoom · Pressione <strong className="text-slate-200">ESC</strong> ou clique fora para fechar
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 9: LGPD, PRIVACIDADE & OBRIGAÇÕES LEGAIS DA INTERNET
         ===================================================================== */}
      {showLegalModal && (
        <div
          style={{ zIndex: 9998 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setShowLegalModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">
                    Transparência, Privacidade & Legislação Digital
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-sans">
                    LGPD, Proteção de Dados & Obrigações de Internet
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
                aria-label="Fechar aviso legal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setLegalModalTab('lgpd')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  legalModalTab === 'lgpd'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. LGPD (Lei nº 13.709/2018)
              </button>
              <button
                type="button"
                onClick={() => setLegalModalTab('internet')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  legalModalTab === 'internet'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Marco Civil & Comércio Digital
              </button>
              <button
                type="button"
                onClick={() => setLegalModalTab('direitos')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  legalModalTab === 'direitos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Direitos do Titular & Dados
              </button>
            </div>

            {/* Tab 1: LGPD */}
            {legalModalTab === 'lgpd' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Tratamento de Dados Pessoais — Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Este catálogo digital segue os princípios de finalidade, adequação, necessidade,
                    transparência e segurança previstos nos artigos 6º e 7º da LGPD.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      • Quais dados são coletados?
                    </div>
                    <p className="text-xs text-slate-600">
                      Apenas os dados estritamente necessários informados voluntariamente pelo
                      cliente (Nome/Empresa e Telefone/WhatsApp) e o histórico de equipamentos
                      consultados durante a sessão de orçamento.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      • Qual a finalidade do uso?
                    </div>
                    <p className="text-xs text-slate-600">
                      Vincular o atendimento ao consultor comercial responsável, elaborar cotações
                      personalizadas da tabela de equipamentos e prestar suporte técnico e comercial
                      solicitado pelo próprio titular.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      • Segurança e Autenticação (Art. 46)
                    </div>
                    <p className="text-xs text-slate-600">
                      O acesso ao painel interno exige e-mail confirmado e senha individual
                      (Supabase Auth) e a comunicação com o banco de dados ocorre sob protocolo
                      seguro criptografado (HTTPS/TLS), com controle estrito de permissões por
                      perfil.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      • Não compartilhamento com terceiros
                    </div>
                    <p className="text-xs text-slate-600">
                      Os dados cadastrados no catálogo não são vendidos, alugados ou cedidos a
                      terceiros para fins publicitários externos, permanecendo restritos à operação
                      comercial da empresa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Marco Civil da Internet & Legislação Digital */}
            {legalModalTab === 'internet' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Obrigações Referentes à Legislação de Internet e Comércio Eletrônico
                  </h3>
                  <p className="text-xs text-slate-600">
                    Em cumprimento às normas brasileiras que regulam aplicações de internet,
                    privacidade e relações comerciais digitais:
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      1. Marco Civil da Internet (Lei nº 12.965/2014 e Decreto nº 8.771/2016)
                    </div>
                    <p className="text-xs text-slate-600">
                      Garantia da inviolabilidade e sigilo do fluxo de comunicações pela internet,
                      proteção dos registros de acesso à aplicação em ambiente seguro e controlado, e
                      fornecimento de informações claras sobre coleta e guarda de dados de navegação.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      2. Decreto do Comércio Eletrônico (Decreto nº 7.962/2013) & Código de Defesa do Consumidor (Lei nº 8.078/1990)
                    </div>
                    <p className="text-xs text-slate-600">
                      Apresentação ostensiva e clara das especificações técnicas, códigos de
                      referência, dimensões, fabricante e condições comerciais dos equipamentos, bem
                      como canais diretos de atendimento com o consultor responsável.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                    <div className="text-xs font-bold text-slate-900 mb-1">
                      3. Política de Cookies e Armazenamento Local (LocalStorage / PWA)
                    </div>
                    <p className="text-xs text-slate-600">
                      Utilizamos apenas armazenamento técnico e estritamente funcional no navegador
                      do dispositivo para manter a sessão ativa do orçamento, exibir o catálogo com
                      rapidez e permitir a instalação opcional do aplicativo no celular (iOS/Android),
                      sem rastreamento invasivo entre sites.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Direitos do Titular (Art. 18 LGPD) & Autoatendimento */}
            {legalModalTab === 'direitos' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Direitos do Titular dos Dados (Art. 18 da LGPD)
                  </h3>
                  <p className="text-xs text-slate-600">
                    O titular dos dados pessoais tem direito a obter do controlador, a qualquer
                    momento e mediante requisição: confirmação da existência de tratamento, acesso
                    aos dados, correção de dados incompletos ou desatualizados, anonimização,
                    bloqueio ou eliminação de dados e revogação do consentimento.
                  </p>
                </div>

                {/* Self-service session data control */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Controle de Dados Locais neste Dispositivo
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {currentActiveLead
                          ? `Sessão vinculada a: ${currentActiveLead.clientName} (${currentActiveLead.clientPhone})`
                          : 'Nenhum dado de identificação de cliente vinculado a este navegador no momento.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClientDeleteOwnDataLgpd}
                      className="px-3.5 py-2 text-xs font-semibold border border-red-200 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Apagar Meus Dados (LGPD)
                    </button>
                  </div>

                  {clientDataClearedNotice && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Seus dados e visualizações foram apagados com sucesso (LGPD).
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 bg-white">
                  <div className="text-xs font-bold text-slate-900 mb-1">
                    Canal de Atendimento ao Titular de Dados / Encarregado (DPO)
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    Para solicitar atualização cadastral, confirmação de tratamento ou exclusão
                    definitiva de registros comerciais do banco de dados, entre em contato diretamente
                    com nosso canal de atendimento responsável:
                  </p>
                  <div className="text-xs font-mono-tabular font-semibold text-slate-800">
                    Responsável pelo Atendimento: {currentSeller.name} · Contato: {currentSeller.whatsapp}
                  </div>
                </div>
              </div>
            )}

            {/* Institutional Legal Summary Note (Editable by Administrator) */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Nota Institucional de Conformidade no Rodapé
                </span>
                {isAdminAuthenticated && !editingLegalNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setLegalNoteDraft(legalCustomNote);
                      setEditingLegalNote(true);
                    }}
                    className="text-[11px] font-semibold text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Personalizar texto do rodapé (Admin)</span>
                  </button>
                )}
              </div>

              {editingLegalNote && isAdminAuthenticated ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={legalNoteDraft}
                    onChange={(e) => setLegalNoteDraft(e.target.value)}
                    placeholder="Informe a razão social, CNPJ ou nota de conformidade LGPD..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLegalNote(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cleaned =
                          legalNoteDraft.trim() ||
                          'Campos Equipamentos — Atendimento comercial e proteção de dados em conformidade com a Lei nº 13.709/2018 (LGPD) e Lei nº 12.965/2014 (Marco Civil da Internet).';
                        setLegalCustomNote(cleaned);
                        try {
                          localStorage.setItem('campos_legal_custom_note', cleaned);
                        } catch {
                          // ignore storage errors
                        }
                        setEditingLegalNote(false);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      Salvar Nota no Rodapé
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{legalCustomNote}</p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendi e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 9: CLIENT FAVORITES / WISHLIST MODAL (LISTA DE DESEJOS)
         ===================================================================== */}
      {showFavoritesModal && (
        <div
          style={{ zIndex: 9995 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowFavoritesModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 fill-red-600 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 font-sans truncate">
                    Favoritos & Lista de Desejos ({favoriteProducts.length})
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Equipamentos selecionados para revisão rápida e cotação com {currentSeller.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {favoriteProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFavoriteProductIds([])}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Lista</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFavoritesModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Fechar Lista de Desejos"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {favoriteProducts.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Heart className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1 font-sans">
                    Sua Lista de Desejos está vazia
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                    Clique no ícone de coração em qualquer card de equipamento no catálogo para salvar
                    seus itens favoritos e revisá-los rapidamente aqui.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFavoritesModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Explorar Catálogo de Equipamentos
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteProducts.map((item) => {
                    const { productCode, manufacturerRef, cleanDimensions } =
                      parseProductCodeAndRef(item);
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div
                          onClick={() => {
                            setShowFavoritesModal(false);
                            handleInspectProduct(item);
                          }}
                          className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="w-20 h-16 rounded-lg border border-slate-200 bg-white p-1.5 flex items-center justify-center shrink-0">
                            <SafeImage
                              src={item.primaryImage}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-red-700 truncate mb-0.5">
                              {parseProductSegments(item.category).join(' · ')}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 hover:text-red-700 transition-colors truncate">
                              {item.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                              {showProductCodeInCatalog && <span>Cód: {productCode}</span>}
                              {showProductCodeInCatalog &&
                                showManufacturerRefInCatalog &&
                                manufacturerRef && <span aria-hidden="true">·</span>}
                              {showManufacturerRefInCatalog && manufacturerRef && (
                                <span>Ref: {manufacturerRef}</span>
                              )}
                              {showDimensionsInCatalog && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate max-w-[220px]">
                                    {item.material} · {cleanDimensions}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          <div className="text-left sm:text-right">
                            {showPricesInCatalog ? (
                              <>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                                  Tabela PB-10X
                                </div>
                                <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                                  {formatCurrency(item.price)}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-slate-700">
                                Sob consulta
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowFavoritesModal(false);
                                handleInspectProduct(item);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              Ver Detalhes
                            </button>
                            <button
                              type="button"
                              onClick={(e) => toggleFavoriteProduct(item, e)}
                              title="Remover dos Favoritos"
                              className="p-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with Summary & Direct WhatsApp Quote Action */}
            {favoriteProducts.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {favoriteProducts.length}{' '}
                    {favoriteProducts.length === 1
                      ? 'equipamento selecionado'
                      : 'equipamentos selecionados'}
                  </div>
                  {showPricesInCatalog && (
                    <div className="text-base font-bold text-slate-900 font-mono-tabular">
                      Total estimado:{' '}
                      {formatCurrency(
                        favoriteProducts.reduce((sum, p) => sum + (p.price || 0), 0)
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('Favoritos');
                      setShowFavoritesModal(false);
                    }}
                    className="px-3.5 py-2.5 text-xs font-semibold border border-slate-300 bg-white text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Filtrar Favoritos no Catálogo
                  </button>

                  {showWhatsappInCatalog &&
                    currentSeller.whatsapp &&
                    currentSeller.id !== 'atendimento_geral' && (
                      <a
                        href={`https://wa.me/55${currentSeller.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${currentSeller.name}${
                            currentActiveLead ? `, meu nome é ${currentActiveLead.clientName}` : ''
                          }! Selecionei ${favoriteProducts.length} equipamento(s) nos meus Favoritos do catálogo e gostaria de uma cotação:\n\n` +
                            favoriteProducts
                              .map(
                                (p, i) =>
                                  `${i + 1}. ${p.name} (${p.sku}${
                                    showPricesInCatalog ? ` - ${formatCurrency(p.price)}` : ''
                                  })`
                              )
                              .join('\n')
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Cotar Favoritos no WhatsApp</span>
                      </a>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact Single-Row Footer with LGPD & Legal Modal Link */}
      <footer className="border-t border-slate-200 bg-white px-6 lg:px-12 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <img
              src={companyLogoUrl}
              alt="Logomarca da Empresa"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
              }}
              className="h-7 sm:h-8 w-auto object-contain"
            />
            <span aria-hidden="true">·</span>
            <span>Catálogo Digital de Equipamentos</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setLegalModalTab('lgpd');
                setShowLegalModal(true);
              }}
              className="text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5 text-red-700" />
              <span>LGPD, Privacidade & Termos Legais</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPWAInstallerModal(true)}
              className="text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
            >
              Instalar App (iOS / Android)
            </button>

            {isClientMode && (
              <button
                type="button"
                onClick={() => setIsClientMode(false)}
                className="text-slate-400 hover:text-slate-700 underline cursor-pointer"
              >
                Painel Interno
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
