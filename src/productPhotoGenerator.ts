const SPEC_INOX_URL = '/equipments/spec-inox.svg';
const SPEC_NR12_URL = '/equipments/spec-nr12.svg';

export interface ProductPhotoMetadata {
  name: string;
  sku: string;
  dimensions?: string;
  material?: string;
  category?: string;
}

const GENERIC_CATEGORY_IMAGES = new Set([
  '/equipments/panificacao.svg',
  '/equipments/refrigeracao.svg',
  '/equipments/vitrine.svg',
  '/equipments/coccao.svg',
  '/equipments/acougue.svg',
  '/equipments/balanca.svg',
  '',
]);

export function isGenericPlaceholderImage(url: string | undefined | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  return GENERIC_CATEGORY_IMAGES.has(trimmed);
}

function escapeXml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function extractProductIdentity(meta: ProductPhotoMetadata): {
  cleanName: string;
  productCode: string;
  manufacturerRef: string;
  manufacturerName: string;
  cleanSpecs: string;
} {
  const rawName = (meta.name || 'EQUIPAMENTO COMERCIAL').trim();
  const rawSku = (meta.sku || '').trim();
  const rawDims = (meta.dimensions || '').trim();
  const rawMat = (meta.material || '').trim();

  // Extract Product Code and Manufacturer Reference from SKU + Dimensions
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

  let cleanSpecs = rawDims;
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
    cleanSpecs = dimParts.slice(1).join(' · ').trim() || rawDims;
  }

  // Extract Manufacturer Name from material field or product name
  let manufacturerName = '';
  const matParts = rawMat
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);

  if (matParts.length > 0) {
    const firstPart = matParts[0];
    if (/^fabricante\s*:/i.test(firstPart)) {
      manufacturerName = firstPart.replace(/^fabricante\s*:\s*/i, '').trim();
    } else if (matParts.length >= 2 && firstPart.length <= 22) {
      manufacturerName = firstPart;
    }
  }

  if (!manufacturerName) {
    const knownBrands = [
      'G PANIZ',
      'G.PANIZ',
      'FRICON',
      'BRAESI',
      'VENANCIO',
      'VENÂNCIO',
      'PROGAS',
      'PROGÁS',
      'MARCHESONI',
      'MARCHESO',
      'BERMAR',
      'GASTROMAQ',
      'BALMAK',
      'VISA',
      'POLAR',
      'IGLU',
      'CIMAPI',
      'EDANCA',
      'FRISBEL',
      'SKYMSEN',
      'METVISA',
      'GELOPAR',
      'METALFRIO',
      'TOLEDO',
      'URANO',
      'TEDESCO',
      'IMECA',
      ' BECKER',
    ];
    const upperName = rawName.toUpperCase();
    for (const brand of knownBrands) {
      if (upperName.includes(brand.trim())) {
        manufacturerName = brand.trim() === 'MARCHESO' ? 'MARCHESONI' : brand.trim();
        break;
      }
    }
  }

  if (!manufacturerName) {
    manufacturerName = rawMat ? rawMat.split('·')[0].trim() : 'LINHA INDUSTRIAL';
  }

  return {
    cleanName: rawName,
    productCode: productCode || 'S/CÓD',
    manufacturerRef: manufacturerRef || 'PADRÃO FAB.',
    manufacturerName: manufacturerName.toUpperCase(),
    cleanSpecs: cleanSpecs || 'Equipamento Profissional',
  };
}

function getBrandTheme(brand: string): {
  badgeBg: string;
  badgeText: string;
  accent: string;
} {
  const b = brand.toUpperCase();
  if (b.includes('FRICON')) {
    return { badgeBg: '#0369A1', badgeText: '#FFFFFF', accent: '#0284C7' };
  }
  if (b.includes('PANIZ')) {
    return { badgeBg: '#B91C1C', badgeText: '#FFFFFF', accent: '#DC2626' };
  }
  if (b.includes('BRAESI')) {
    return { badgeBg: '#991B1B', badgeText: '#FFFFFF', accent: '#EF4444' };
  }
  if (b.includes('PROGAS') || b.includes('PROGÁS')) {
    return { badgeBg: '#C2410C', badgeText: '#FFFFFF', accent: '#EA580C' };
  }
  if (b.includes('VENANCIO') || b.includes('VENÂNCIO')) {
    return { badgeBg: '#B91C1C', badgeText: '#FFFFFF', accent: '#DC2626' };
  }
  if (b.includes('BALMAK')) {
    return { badgeBg: '#0F172A', badgeText: '#38BDF8', accent: '#0284C7' };
  }
  if (b.includes('BERMAR')) {
    return { badgeBg: '#1E3A8A', badgeText: '#FFFFFF', accent: '#2563EB' };
  }
  if (b.includes('GASTROMAQ')) {
    return { badgeBg: '#1D4ED8', badgeText: '#FFFFFF', accent: '#3B82F6' };
  }
  if (b.includes('MARCHES')) {
    return { badgeBg: '#B45309', badgeText: '#FFFFFF', accent: '#D97706' };
  }
  if (b.includes('POLAR')) {
    return { badgeBg: '#18181B', badgeText: '#F43F5E', accent: '#E11D48' };
  }
  if (b.includes('IGLU')) {
    return { badgeBg: '#0F766E', badgeText: '#FFFFFF', accent: '#0D9488' };
  }
  if (b.includes('VISA')) {
    return { badgeBg: '#1E293B', badgeText: '#F8FAFC', accent: '#DC2626' };
  }
  if (b.includes('CIMAPI')) {
    return { badgeBg: '#334155', badgeText: '#FFFFFF', accent: '#64748B' };
  }
  if (b.includes('EDANCA')) {
    return { badgeBg: '#9A3412', badgeText: '#FFFFFF', accent: '#EA580C' };
  }
  if (b.includes('FRISBEL')) {
    return { badgeBg: '#0369A1', badgeText: '#E0F2FE', accent: '#0EA5E9' };
  }
  return { badgeBg: '#0F172A', badgeText: '#FFFFFF', accent: '#B91C1C' };
}

function renderEquipmentArtwork(
  upperName: string,
  manufacturerName: string,
  manufacturerRef: string,
  accentColor: string
): string {
  const safeBrand = escapeXml(manufacturerName.slice(0, 14));
  const safeRef = escapeXml(manufacturerRef.slice(0, 16));

  // 1. AMACIADOR DE CARNE
  if (upperName.includes('AMACIADOR')) {
    return `
      <!-- Base Platform -->
      <rect x="230" y="405" width="340" height="22" rx="6" fill="#475569" stroke="#1E293B" stroke-width="3"/>
      <rect x="255" y="427" width="28" height="14" rx="4" fill="#0F172A"/>
      <rect x="517" y="427" width="28" height="14" rx="4" fill="#0F172A"/>
      <!-- Motor Housing (Left) -->
      <rect x="245" y="195" width="185" height="210" rx="12" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3.5"/>
      <!-- Louvers -->
      <line x1="270" y1="295" x2="345" y2="295" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
      <line x1="270" y1="312" x2="345" y2="312" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
      <line x1="270" y1="329" x2="345" y2="329" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
      <line x1="270" y1="346" x2="345" y2="346" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
      <!-- Brand Plate on Motor -->
      <rect x="270" y="220" width="130" height="32" rx="5" fill="${accentColor}"/>
      <text x="335" y="241" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <!-- Tenderizer Head & Rollers (Right) -->
      <rect x="430" y="215" width="125" height="135" rx="10" fill="#E2E8F0" stroke="#334155" stroke-width="3.5"/>
      <!-- Top Safety Feed Chute NR12 -->
      <polygon points="445,165 540,165 525,215 460,215" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3"/>
      <!-- Internal Toothed Rollers Window -->
      <rect x="448" y="242" width="88" height="62" rx="6" fill="#0F172A" stroke="#475569" stroke-width="2"/>
      <line x1="455" y1="264" x2="529" y2="264" stroke="#94A3B8" stroke-width="5" stroke-dasharray="6 4"/>
      <line x1="455" y1="284" x2="529" y2="284" stroke="#CBD5E1" stroke-width="5" stroke-dasharray="6 4"/>
      <!-- Output Tray Below Rollers -->
      <rect x="425" y="375" width="140" height="28" rx="5" fill="url(#inoxGrad)" stroke="#475569" stroke-width="2.5"/>
      <!-- Power Switch & Emergency Stop -->
      <circle cx="395" cy="315" r="14" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5"/>
      <circle cx="395" cy="355" r="9" fill="#16A34A"/>
    `;
  }

  // 2. AMASSADEIRA ESPIRAL
  if (upperName.includes('AMASSADEIRA') && upperName.includes('ESPIRAL')) {
    return `
      <!-- Heavy Base -->
      <path d="M230 390 L550 390 L550 432 L230 432 Z" fill="#334155" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Rear Column -->
      <rect x="235" y="150" width="125" height="245" rx="10" fill="#F8FAFC" stroke="#334155" stroke-width="3.5"/>
      <!-- Top Arm Overhang -->
      <path d="M235 145 L515 145 Q540 145 540 170 L540 220 L235 220 Z" fill="#F1F5F9" stroke="#334155" stroke-width="3.5"/>
      <!-- Brand Stripe & Digital Panel -->
      <rect x="255" y="162" width="145" height="36" rx="5" fill="${accentColor}"/>
      <text x="327" y="185" font-family="sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <rect x="425" y="160" width="95" height="40" rx="5" fill="#0F172A"/>
      <text x="472" y="185" font-family="monospace" font-size="13" font-weight="700" fill="#38BDF8" text-anchor="middle">AE-25 · 380V</text>
      <!-- NR12 Safety Grid -->
      <path d="M365 220 L545 220 L535 268 L375 268 Z" fill="#E2E8F0" fill-opacity="0.55" stroke="#475569" stroke-width="2.5"/>
      <line x1="395" y1="220" x2="395" y2="268" stroke="#64748B" stroke-width="2"/>
      <line x1="425" y1="220" x2="425" y2="268" stroke="#64748B" stroke-width="2"/>
      <line x1="455" y1="220" x2="455" y2="268" stroke="#64748B" stroke-width="2"/>
      <line x1="485" y1="220" x2="485" y2="268" stroke="#64748B" stroke-width="2"/>
      <line x1="515" y1="220" x2="515" y2="268" stroke="#64748B" stroke-width="2"/>
      <!-- Spiral Hook -->
      <path d="M455 220 C435 250 475 265 450 295" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
      <!-- Stainless Steel 25kg Bowl (Cuba Inox) -->
      <rect x="360" y="268" width="190" height="122" rx="18" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3.5"/>
      <line x1="365" y1="305" x2="545" y2="305" stroke="#94A3B8" stroke-width="2"/>
    `;
  }

  // 3. AMASSADEIRA RÁPIDA
  if (upperName.includes('AMASSADEIRA')) {
    return `
      <!-- Cabinet Stand -->
      <rect x="245" y="275" width="310" height="155" rx="8" fill="#F8FAFC" stroke="#334155" stroke-width="3.5"/>
      <!-- Bottom Feet -->
      <rect x="265" y="430" width="26" height="12" rx="3" fill="#0F172A"/>
      <rect x="509" y="430" width="26" height="12" rx="3" fill="#0F172A"/>
      <!-- Upper Stainless Trough (Cuba) -->
      <path d="M235 175 L565 175 L545 275 L255 275 Z" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3.5"/>
      <!-- Hinged Lid with NR12 Sensor -->
      <rect x="230" y="152" width="340" height="23" rx="6" fill="#CBD5E1" stroke="#1E293B" stroke-width="3"/>
      <rect x="370" y="136" width="60" height="16" rx="4" fill="#1E293B"/>
      <!-- Brand & Control Panel -->
      <rect x="275" y="305" width="140" height="36" rx="6" fill="${accentColor}"/>
      <text x="345" y="328" font-family="sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <circle cx="485" cy="323" r="15" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5"/>
      <circle cx="522" cy="323" r="10" fill="#16A34A"/>
      <!-- Ventilation Grille -->
      <line x1="275" y1="370" x2="395" y2="370" stroke="#94A3B8" stroke-width="3"/>
      <line x1="275" y1="386" x2="395" y2="386" stroke="#94A3B8" stroke-width="3"/>
      <line x1="275" y1="402" x2="395" y2="402" stroke="#94A3B8" stroke-width="3"/>
    `;
  }

  // 4. BATEDEIRA PLANETÁRIA
  if (upperName.includes('BATEDEIRA') || upperName.includes('PLANETARIA')) {
    return `
      <!-- Base Foot -->
      <path d="M275 405 L525 405 L535 435 L265 435 Z" fill="#334155" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Rear Support Column -->
      <rect x="285" y="155" width="90" height="250" rx="8" fill="#F1F5F9" stroke="#334155" stroke-width="3.5"/>
      <!-- Planetary Top Motor Head -->
      <path d="M275 135 L515 135 Q535 135 535 160 L535 215 L275 215 Z" fill="#E2E8F0" stroke="#1E293B" stroke-width="3.5"/>
      <rect x="295" y="153" width="130" height="30" rx="5" fill="${accentColor}"/>
      <text x="360" y="173" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <!-- Speed Variator & Stop -->
      <circle cx="485" cy="170" r="14" fill="#DC2626" stroke="#7F1D1D" stroke-width="2"/>
      <!-- Wire Whisk & NR12 Cage -->
      <rect x="395" y="215" width="120" height="65" rx="6" fill="#E0F2FE" fill-opacity="0.35" stroke="#64748B" stroke-width="2" stroke-dasharray="5 3"/>
      <ellipse cx="455" cy="252" rx="26" ry="30" fill="none" stroke="#334155" stroke-width="3"/>
      <ellipse cx="455" cy="252" rx="13" ry="30" fill="none" stroke="#334155" stroke-width="2.5"/>
      <!-- 12L Stainless Bowl -->
      <path d="M385 275 L525 275 L510 385 Q455 402 400 385 Z" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3.5"/>
    `;
  }

  // 5. CILINDRO LAMINADOR / MODELADORA
  if (upperName.includes('CILINDRO') || upperName.includes('MODELADORA')) {
    const isModeladora = upperName.includes('MODELADORA');
    return `
      <!-- Stand Legs -->
      <rect x="240" y="295" width="320" height="135" rx="6" fill="#F8FAFC" stroke="#334155" stroke-width="3.5"/>
      <line x1="255" y1="365" x2="545" y2="365" stroke="#CBD5E1" stroke-width="4"/>
      <!-- Upper Machine Housing -->
      <rect x="220" y="165" width="360" height="135" rx="10" fill="url(#inoxGrad)" stroke="#1E293B" stroke-width="3.5"/>
      <!-- Top Adjustment Wheels -->
      <circle cx="275" cy="148" r="14" fill="#0F172A"/>
      <circle cx="525" cy="148" r="14" fill="#0F172A"/>
      <!-- Twin Polished Laminating Rollers (390mm / 35cm) -->
      <rect x="265" y="215" width="270" height="24" rx="10" fill="#F8FAFC" stroke="#334155" stroke-width="3"/>
      <rect x="265" y="243" width="270" height="24" rx="10" fill="#CBD5E1" stroke="#334155" stroke-width="3"/>
      <!-- NR12 Protection Cover & Emergency Button -->
      <rect x="265" y="178" width="270" height="30" rx="5" fill="${accentColor}"/>
      <text x="400" y="198" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · ${isModeladora ? 'MODELADORA NR12' : 'CILINDRO INOX NR12'}</text>
      <circle cx="555" cy="195" r="11" fill="#DC2626" stroke="#FFFFFF" stroke-width="2"/>
      <!-- Output Dough Tray -->
      <polygon points="250,275 550,275 570,315 230,315" fill="#E2E8F0" stroke="#475569" stroke-width="2.5"/>
    `;
  }

  // 6. FORNO TURBO (10 TELAS A GÁS OU ELÉTRICO)
  if (upperName.includes('FORNO') && upperName.includes('TURBO')) {
    const isElectric = upperName.includes('ELETRICO') || upperName.includes('FVT');
    return `
      <!-- Tall Bakery Oven Body -->
      <rect x="225" y="110" width="350" height="330" rx="10" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="4"/>
      <!-- Left Digital Control Column -->
      <rect x="238" y="125" width="78" height="300" rx="6" fill="#0F172A"/>
      <rect x="248" y="140" width="58" height="28" rx="4" fill="#0284C7"/>
      <text x="277" y="159" font-family="monospace" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">185°C</text>
      <rect x="248" y="176" width="58" height="22" rx="3" fill="#1E293B"/>
      <text x="277" y="191" font-family="monospace" font-size="10" fill="#38BDF8" text-anchor="middle">10 TELAS</text>
      <circle cx="277" cy="235" r="12" fill="#16A34A"/>
      <circle cx="277" cy="272" r="12" fill="#DC2626"/>
      <rect x="246" y="365" width="62" height="24" rx="4" fill="${accentColor}"/>
      <text x="277" y="381" font-family="sans-serif" font-size="10" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <!-- Panoramic Double Glass Door -->
      <rect x="330" y="128" width="225" height="294" rx="8" fill="#1E293B" stroke="#334155" stroke-width="3"/>
      <rect x="346" y="144" width="193" height="262" rx="6" fill="#FFFBEB" fill-opacity="0.88" stroke="#F59E0B" stroke-width="2"/>
      <!-- Rear Turbo Turbine Fan -->
      <circle cx="442" cy="275" r="38" fill="#FDE68A" stroke="#D97706" stroke-width="2" stroke-dasharray="6 4"/>
      <!-- 10 Baking Trays (Esteiras) -->
      <line x1="356" y1="162" x2="529" y2="162" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="186" x2="529" y2="186" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="210" x2="529" y2="210" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="234" x2="529" y2="234" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="258" x2="529" y2="258" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="282" x2="529" y2="282" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="306" x2="529" y2="306" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="330" x2="529" y2="330" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="354" x2="529" y2="354" stroke="#78350F" stroke-width="3"/>
      <line x1="356" y1="378" x2="529" y2="378" stroke="#78350F" stroke-width="3"/>
      <!-- Door Latch Handle -->
      <rect x="333" y="245" width="10" height="65" rx="4" fill="#F8FAFC" stroke="#0F172A" stroke-width="2"/>
      <!-- Top Badge -->
      <text x="442" y="400" font-family="monospace" font-size="11" font-weight="700" fill="#92400E" text-anchor="middle">${isElectric ? 'TURBO ELÉTRICO' : 'TURBO A GÁS'}</text>
    `;
  }

  // 7. FORNO INDUSTRIAL DE CÂMARA / LASTRO (VENÂNCIO ROMA 110)
  if (upperName.includes('FORNO')) {
    return `
      <!-- Reinforced Support Stand Legs -->
      <line x1="235" y1="335" x2="235" y2="438" stroke="#334155" stroke-width="10"/>
      <line x1="565" y1="335" x2="565" y2="438" stroke="#334155" stroke-width="10"/>
      <line x1="235" y1="400" x2="565" y2="400" stroke="#475569" stroke-width="5"/>
      <!-- Stainless Steel Oven Chamber 110 -->
      <rect x="215" y="140" width="370" height="200" rx="8" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="4"/>
      <!-- Glass Viewing Window & Internal Refractory Glow -->
      <rect x="255" y="175" width="290" height="105" rx="6" fill="#451A03" stroke="#334155" stroke-width="3"/>
      <line x1="265" y1="228" x2="535" y2="228" stroke="#F59E0B" stroke-width="3" stroke-dasharray="8 4"/>
      <line x1="265" y1="265" x2="535" y2="265" stroke="#D97706" stroke-width="5"/>
      <!-- Top Handle & Analog Thermometer -->
      <rect x="290" y="152" width="220" height="10" rx="4" fill="#0F172A"/>
      <circle cx="555" cy="160" r="14" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
      <line x1="555" y1="160" x2="562" y2="153" stroke="#DC2626" stroke-width="2"/>
      <!-- Brand Plate & Lower Gas Control -->
      <rect x="255" y="295" width="135" height="26" rx="4" fill="${accentColor}"/>
      <text x="322" y="313" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · ROMA</text>
      <circle cx="515" cy="308" r="10" fill="#0F172A"/>
    `;
  }

  // 8. FOGÃO INDUSTRIAL 6 BOCAS ALTA PRESSÃO
  if (upperName.includes('FOGAO')) {
    return `
      <!-- Legs & Lower Shelf -->
      <line x1="185" y1="265" x2="185" y2="435" stroke="#334155" stroke-width="10"/>
      <line x1="615" y1="265" x2="615" y2="435" stroke="#334155" stroke-width="10"/>
      <rect x="185" y="375" width="430" height="12" fill="#94A3B8" stroke="#334155" stroke-width="2"/>
      <!-- Main Stainless Body -->
      <rect x="170" y="205" width="460" height="72" rx="6" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- 6 Cast Iron Grates (6 Bocas) + Blue/Orange Flames -->
      <rect x="195" y="182" width="110" height="23" rx="3" fill="#1E293B"/>
      <ellipse cx="250" cy="180" rx="28" ry="6" fill="#38BDF8"/>
      <rect x="345" y="182" width="110" height="23" rx="3" fill="#1E293B"/>
      <ellipse cx="400" cy="180" rx="28" ry="6" fill="#38BDF8"/>
      <rect x="495" y="182" width="110" height="23" rx="3" fill="#1E293B"/>
      <ellipse cx="550" cy="180" rx="28" ry="6" fill="#38BDF8"/>
      <!-- Front Gas Manifold Pipe & 6 High-Pressure Valves -->
      <line x1="175" y1="242" x2="625" y2="242" stroke="#475569" stroke-width="7" stroke-linecap="round"/>
      <circle cx="215" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <circle cx="285" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <circle cx="360" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <circle cx="440" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <circle cx="515" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <circle cx="585" cy="242" r="9" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
      <!-- Brand Badge -->
      <rect x="330" y="295" width="140" height="30" rx="5" fill="${accentColor}"/>
      <text x="400" y="315" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} 6 BOCAS</text>
    `;
  }

  // 9. CHAPA BIFETEIRA A GÁS 1,00M
  if (upperName.includes('CHAPA')) {
    return `
      <!-- Splash Guards & Thick Carbon Steel Plate -->
      <path d="M165 210 L635 210 L620 265 L180 265 Z" fill="#475569" stroke="#0F172A" stroke-width="3.5"/>
      <rect x="165" y="255" width="470" height="20" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
      <!-- Stainless Steel Front Body (1,00m) -->
      <rect x="165" y="275" width="470" height="95" rx="6" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Rubber Feet -->
      <rect x="190" y="370" width="28" height="22" rx="4" fill="#0F172A"/>
      <rect x="582" y="370" width="28" height="22" rx="4" fill="#0F172A"/>
      <!-- Grease Collector Drawer (Left) -->
      <rect x="190" y="305" width="85" height="42" rx="4" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
      <rect x="215" y="321" width="35" height="8" rx="3" fill="#0F172A"/>
      <!-- Brand Badge -->
      <rect x="295" y="292" width="115" height="28" rx="4" fill="${accentColor}"/>
      <text x="352" y="311" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} 1,00M</text>
      <!-- 4 Gas Burner Knobs -->
      <circle cx="445" cy="325" r="12" fill="#0F172A" stroke="#DC2626" stroke-width="2.5"/>
      <circle cx="490" cy="325" r="12" fill="#0F172A" stroke="#DC2626" stroke-width="2.5"/>
      <circle cx="535" cy="325" r="12" fill="#0F172A" stroke="#DC2626" stroke-width="2.5"/>
      <circle cx="580" cy="325" r="12" fill="#0F172A" stroke="#DC2626" stroke-width="2.5"/>
    `;
  }

  // 10. FRITADOR ELÉTRICO ÁGUA E ÓLEO 25L
  if (upperName.includes('FRITAD')) {
    return `
      <!-- Pedestal Legs -->
      <line x1="280" y1="325" x2="265" y2="438" stroke="#334155" stroke-width="9"/>
      <line x1="520" y1="325" x2="535" y2="438" stroke="#334155" stroke-width="9"/>
      <line x1="272" y1="395" x2="528" y2="395" stroke="#64748B" stroke-width="5"/>
      <!-- Twin Wire Frying Baskets + Handles -->
      <rect x="285" y="145" width="105" height="55" rx="4" fill="#FEF3C7" stroke="#475569" stroke-width="2.5" stroke-dasharray="5 3"/>
      <rect x="410" y="145" width="105" height="55" rx="4" fill="#FEF3C7" stroke="#475569" stroke-width="2.5" stroke-dasharray="5 3"/>
      <path d="M335 145 L335 118 L315 118" fill="none" stroke="#0F172A" stroke-width="5" stroke-linecap="round"/>
      <path d="M465 145 L465 118 L485 118" fill="none" stroke="#0F172A" stroke-width="5" stroke-linecap="round"/>
      <!-- 25L Stainless Tank (Cuba Água/Óleo Inox 304) -->
      <path d="M255 200 L545 200 L520 330 L280 330 Z" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Control Panel Box -->
      <rect x="330" y="225" width="140" height="68" rx="6" fill="#0F172A"/>
      <text x="400" y="248" font-family="sans-serif" font-size="13" font-weight="800" fill="#FBBF24" text-anchor="middle">${safeBrand} 25L</text>
      <circle cx="365" cy="272" r="10" fill="#DC2626"/>
      <text x="425" y="276" font-family="monospace" font-size="12" font-weight="700" fill="#38BDF8" text-anchor="middle">180 °C</text>
      <!-- Lower Oil/Water Drain Valve -->
      <rect x="392" y="330" width="16" height="28" fill="#475569"/>
      <circle cx="400" cy="358" r="8" fill="#DC2626"/>
    `;
  }

  // 11. CAFETEIRA PROFISSIONAL 8L CAFÉ/LEITE 2X4
  if (upperName.includes('CAFETEIRA')) {
    return `
      <!-- Base Drip Tray -->
      <rect x="260" y="405" width="280" height="28" rx="6" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
      <!-- Cylindrical Stainless Body (Inox 304) -->
      <rect x="285" y="145" width="230" height="260" rx="18" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Twin Top Lids (2x4L Café & Leite) -->
      <rect x="305" y="125" width="85" height="20" rx="6" fill="#334155"/>
      <rect x="410" y="125" width="85" height="20" rx="6" fill="#334155"/>
      <!-- Brand Header -->
      <rect x="320" y="175" width="160" height="32" rx="5" fill="${accentColor}"/>
      <text x="400" y="196" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} 2x4L</text>
      <!-- Sight Glasses & Dual Taps (Café / Leite) -->
      <rect x="335" y="225" width="12" height="95" rx="5" fill="#451A03" stroke="#475569" stroke-width="2"/>
      <rect x="453" y="225" width="12" height="95" rx="5" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
      <circle cx="341" cy="338" r="11" fill="#0F172A"/>
      <circle cx="459" cy="338" r="11" fill="#0F172A"/>
      <text x="341" y="365" font-family="sans-serif" font-size="10" font-weight="700" fill="#0F172A" text-anchor="middle">CAFÉ 4L</text>
      <text x="459" y="365" font-family="sans-serif" font-size="10" font-weight="700" fill="#0F172A" text-anchor="middle">LEITE 4L</text>
      <!-- Thermostat Dial -->
      <circle cx="400" cy="378" r="12" fill="#DC2626" stroke="#0F172A" stroke-width="2"/>
    `;
  }

  // 12. BUFFET TÉRMICO 12 CUBAS
  if (upperName.includes('BUFFET')) {
    return `
      <!-- Tubular Stand & Casters -->
      <line x1="190" y1="305" x2="190" y2="425" stroke="#334155" stroke-width="8"/>
      <line x1="610" y1="305" x2="610" y2="425" stroke="#334155" stroke-width="8"/>
      <circle cx="190" cy="432" r="9" fill="#0F172A"/>
      <circle cx="610" cy="432" r="9" fill="#0F172A"/>
      <!-- Curved Tempered Glass Sneeze Guard (Protetor Salivador) -->
      <path d="M165 185 Q400 130 635 185 L615 235 Q400 190 185 235 Z" fill="url(#glassGrad)" stroke="#0284C7" stroke-width="2.5"/>
      <line x1="250" y1="175" x2="250" y2="255" stroke="#475569" stroke-width="4"/>
      <line x1="550" y1="175" x2="550" y2="255" stroke="#475569" stroke-width="4"/>
      <!-- 12 GN Pans (Cubas Inox) -->
      <rect x="175" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <rect x="249" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <rect x="323" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <rect x="397" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <rect x="471" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <rect x="545" y="242" width="68" height="16" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      <!-- Thermal Bath Tank -->
      <rect x="165" y="258" width="470" height="52" rx="6" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <rect x="320" y="271" width="160" height="26" rx="4" fill="${accentColor}"/>
      <text x="400" y="289" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · 12 CUBAS</text>
    `;
  }

  // 13. BEBEDOURO INDUSTRIAL 3 TORNEIRAS 100L INOX
  if (upperName.includes('BEBEDOURO')) {
    return `
      <!-- Tall Inox Column (100L) -->
      <rect x="275" y="105" width="250" height="330" rx="10" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="4"/>
      <!-- Brand Header -->
      <rect x="315" y="130" width="170" height="32" rx="5" fill="${accentColor}"/>
      <text x="400" y="151" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · 100L</text>
      <!-- Recessed Drip Tray & 3 Chrome Faucets -->
      <rect x="300" y="195" width="200" height="95" rx="6" fill="#CBD5E1" stroke="#334155" stroke-width="3"/>
      <rect x="300" y="270" width="200" height="20" fill="#64748B"/>
      <!-- 3 Torneiras -->
      <circle cx="340" cy="222" r="10" fill="#0284C7" stroke="#0F172A" stroke-width="2.5"/>
      <rect x="336" y="232" width="8" height="18" rx="2" fill="#0F172A"/>
      <circle cx="400" cy="222" r="10" fill="#0284C7" stroke="#0F172A" stroke-width="2.5"/>
      <rect x="396" y="232" width="8" height="18" rx="2" fill="#0F172A"/>
      <circle cx="460" cy="222" r="10" fill="#0284C7" stroke="#0F172A" stroke-width="2.5"/>
      <rect x="456" y="232" width="8" height="18" rx="2" fill="#0F172A"/>
      <!-- Lower Condenser Louvers -->
      <line x1="310" y1="345" x2="490" y2="345" stroke="#475569" stroke-width="3"/>
      <line x1="310" y1="362" x2="490" y2="362" stroke="#475569" stroke-width="3"/>
      <line x1="310" y1="379" x2="490" y2="379" stroke="#475569" stroke-width="3"/>
      <line x1="310" y1="396" x2="490" y2="396" stroke="#475569" stroke-width="3"/>
    `;
  }

  // 14. CERVEJEIRA VERTICAL 569L PORTA CHAPA/VIDRO
  if (upperName.includes('CERVEJEIRA')) {
    return `
      <!-- Vertical Dark Cabinet -->
      <rect x="265" y="100" width="270" height="338" rx="12" fill="#0F172A" stroke="#334155" stroke-width="4"/>
      <!-- Top Sub-Zero Controller Header -->
      <rect x="282" y="114" width="236" height="40" rx="6" fill="${accentColor}"/>
      <text x="355" y="139" font-family="sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <rect x="430" y="121" width="74" height="26" rx="4" fill="#0F172A"/>
      <text x="467" y="139" font-family="monospace" font-size="14" font-weight="700" fill="#38BDF8" text-anchor="middle">-5.5°C</text>
      <!-- Hybrid Steel/Glass Door (Porta Chapa/Vidro) -->
      <rect x="285" y="164" width="230" height="228" rx="8" fill="#1E293B" stroke="#475569" stroke-width="3"/>
      <rect x="315" y="182" width="170" height="192" rx="6" fill="url(#glassGrad)" stroke="#38BDF8" stroke-width="2"/>
      <!-- 4 Shelves inside -->
      <line x1="322" y1="225" x2="478" y2="225" stroke="#E2E8F0" stroke-width="3.5"/>
      <line x1="322" y1="268" x2="478" y2="268" stroke="#E2E8F0" stroke-width="3.5"/>
      <line x1="322" y1="311" x2="478" y2="311" stroke="#E2E8F0" stroke-width="3.5"/>
      <line x1="322" y1="350" x2="478" y2="350" stroke="#E2E8F0" stroke-width="3.5"/>
      <!-- Ergonomic Handle -->
      <rect x="496" y="245" width="8" height="68" rx="3" fill="#F8FAFC"/>
      <!-- Bottom Grille -->
      <rect x="285" y="400" width="230" height="26" rx="4" fill="#334155"/>
    `;
  }

  // 15. FREEZER HORIZONTAL EXPOSITOR 503L / ILHA HORIZONTAL 1163L
  if (upperName.includes('FREEZER') || upperName.includes('ILHA')) {
    const isIlha = upperName.includes('ILHA');
    const bodyFill = isIlha ? '#1E293B' : '#F8FAFC';
    const frameFill = isIlha ? '#0F172A' : '#0284C7';
    const textFill = isIlha ? '#FFFFFF' : '#0F172A';
    return `
      <!-- Top Curved Sliding Glass Lids -->
      <path d="M155 215 Q400 192 645 215 L635 250 L165 250 Z" fill="url(#glassGrad)" stroke="${frameFill}" stroke-width="4"/>
      <line x1="400" y1="204" x2="400" y2="250" stroke="${frameFill}" stroke-width="4"/>
      ${isIlha ? '<line x1="280" y1="208" x2="280" y2="250" stroke="#0F172A" stroke-width="3"/><line x1="520" y1="208" x2="520" y2="250" stroke="#0F172A" stroke-width="3"/>' : ''}
      <!-- Horizontal Chest Body -->
      <rect x="155" y="250" width="490" height="175" rx="8" fill="${bodyFill}" stroke="#334155" stroke-width="3.5"/>
      <!-- Bumper Stripes for Island -->
      ${isIlha ? '<line x1="160" y1="355" x2="640" y2="355" stroke="#38BDF8" stroke-width="4"/><line x1="160" y1="370" x2="640" y2="370" stroke="#475569" stroke-width="5"/>' : ''}
      <!-- Brand Badge & Digital Temp -->
      <rect x="190" y="280" width="165" height="38" rx="6" fill="${accentColor}"/>
      <text x="272" y="305" font-family="sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <text x="272" y="340" font-family="sans-serif" font-size="12" font-weight="700" fill="${textFill}" text-anchor="middle">${isIlha ? 'ILHA 3,00M · 1163L LED' : 'FREEZER 503L DUPLA AÇÃO'}</text>
      <!-- Lower Thermostat & Grill -->
      <rect x="520" y="375" width="95" height="32" rx="4" fill="#0F172A"/>
      <text x="567" y="396" font-family="monospace" font-size="13" font-weight="700" fill="#38BDF8" text-anchor="middle">-18.0°C</text>
      <!-- Caster Wheels -->
      <circle cx="195" cy="432" r="8" fill="#0F172A"/>
      <circle cx="605" cy="432" r="8" fill="#0F172A"/>
    `;
  }

  // 16. AUTO SERVIÇO / EXPOSITOR VERTICAL (2,00M / 3,00M / AÇOUGUE 3 PORTAS)
  if (upperName.includes('AUTO SERVICO') || upperName.includes('EXPOSITOR VERT')) {
    const isMeat = upperName.includes('CARNE');
    const isCinza = upperName.includes('CINZA') || upperName.includes('3,00M');
    const cabinetColor = isCinza ? '#475569' : '#0F172A';
    const glassTint = isMeat ? '#FFE4E6' : '#E0F2FE';
    return `
      <!-- Wide 3-Door Commercial Merchandiser Cabinet -->
      <rect x="145" y="108" width="510" height="325" rx="10" fill="${cabinetColor}" stroke="#0F172A" stroke-width="4"/>
      <!-- Top Header with Brand & Digital Controller -->
      <rect x="160" y="120" width="480" height="38" rx="5" fill="#0F172A"/>
      <rect x="172" y="126" width="135" height="26" rx="4" fill="${accentColor}"/>
      <text x="239" y="144" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <rect x="545" y="126" width="80" height="26" rx="4" fill="#0284C7"/>
      <text x="585" y="144" font-family="monospace" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">${isMeat ? '+1.0°C' : '+2.5°C'}</text>
      <!-- 3 Low-E Glass Doors -->
      <rect x="162" y="168" width="152" height="218" rx="6" fill="${glassTint}" fill-opacity="0.82" stroke="#94A3B8" stroke-width="3"/>
      <rect x="324" y="168" width="152" height="218" rx="6" fill="${glassTint}" fill-opacity="0.82" stroke="#94A3B8" stroke-width="3"/>
      <rect x="486" y="168" width="152" height="218" rx="6" fill="${glassTint}" fill-opacity="0.82" stroke="#94A3B8" stroke-width="3"/>
      <!-- Internal Shelves -->
      <line x1="168" y1="218" x2="308" y2="218" stroke="#64748B" stroke-width="3.5"/>
      <line x1="168" y1="268" x2="308" y2="268" stroke="#64748B" stroke-width="3.5"/>
      <line x1="168" y1="318" x2="308" y2="318" stroke="#64748B" stroke-width="3.5"/>
      <line x1="330" y1="218" x2="470" y2="218" stroke="#64748B" stroke-width="3.5"/>
      <line x1="330" y1="268" x2="470" y2="268" stroke="#64748B" stroke-width="3.5"/>
      <line x1="330" y1="318" x2="470" y2="318" stroke="#64748B" stroke-width="3.5"/>
      <line x1="492" y1="218" x2="632" y2="218" stroke="#64748B" stroke-width="3.5"/>
      <line x1="492" y1="268" x2="632" y2="268" stroke="#64748B" stroke-width="3.5"/>
      <line x1="492" y1="318" x2="632" y2="318" stroke="#64748B" stroke-width="3.5"/>
      <!-- Door Handles -->
      <rect x="298" y="255" width="6" height="42" rx="2" fill="#0F172A"/>
      <rect x="460" y="255" width="6" height="42" rx="2" fill="#0F172A"/>
      <rect x="622" y="255" width="6" height="42" rx="2" fill="#0F172A"/>
      <!-- Bottom Compressor Grille -->
      <rect x="162" y="395" width="476" height="26" rx="4" fill="#1E293B"/>
    `;
  }

  // 17. CORTADOR DE FRIOS AUTOMÁTICO 300MM
  if (upperName.includes('CORTADOR') || upperName.includes('FATIADOR')) {
    return `
      <!-- Stainless Steel Angled Base -->
      <path d="M210 355 L580 355 L600 425 L190 425 Z" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <rect x="215" y="425" width="30" height="12" rx="4" fill="#0F172A"/>
      <rect x="545" y="425" width="30" height="12" rx="4" fill="#0F172A"/>
      <!-- Automatic Motor Column -->
      <rect x="435" y="220" width="125" height="135" rx="10" fill="url(#inoxGrad)" stroke="#334155" stroke-width="3.5"/>
      <!-- 300mm Circular Slicing Blade + NR12 Guard Ring -->
      <circle cx="335" cy="240" r="88" fill="#E2E8F0" stroke="#0F172A" stroke-width="5"/>
      <circle cx="335" cy="240" r="68" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2"/>
      <circle cx="335" cy="240" r="22" fill="#334155"/>
      <!-- Sliding Meat Carriage -->
      <polygon points="365,245 505,245 485,355 345,355" fill="url(#inoxGrad)" stroke="#1E293B" stroke-width="3"/>
      <!-- Brand & Controls on Base -->
      <rect x="225" y="372" width="145" height="32" rx="5" fill="${accentColor}"/>
      <text x="297" y="393" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · 300MM</text>
      <circle cx="465" cy="388" r="13" fill="#16A34A"/>
      <circle cx="505" cy="388" r="13" fill="#DC2626"/>
      <circle cx="555" cy="388" r="16" fill="#0F172A"/>
    `;
  }

  // 18. PICADOR / MOEDOR DE CARNE BOCA 22 INOX
  if (upperName.includes('PICADOR') || upperName.includes('MOEDOR')) {
    return `
      <!-- Base -->
      <rect x="225" y="395" width="350" height="28" rx="6" fill="#334155" stroke="#0F172A" stroke-width="3"/>
      <!-- Stainless Steel Motor Housing (1CV) -->
      <rect x="235" y="210" width="215" height="185" rx="12" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Top Feed Tray (Bandeja Inox) + Safety Throat -->
      <polygon points="355,140 565,140 535,180 385,180" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3"/>
      <rect x="435" y="180" width="52" height="65" fill="#CBD5E1" stroke="#0F172A" stroke-width="3"/>
      <!-- Protruding Boca 22 Grinding Head -->
      <rect x="450" y="245" width="110" height="58" rx="8" fill="#94A3B8" stroke="#0F172A" stroke-width="3.5"/>
      <circle cx="560" cy="274" r="32" fill="#E2E8F0" stroke="#0F172A" stroke-width="4"/>
      <circle cx="560" cy="274" r="18" fill="#334155" stroke="#94A3B8" stroke-width="2" stroke-dasharray="3 3"/>
      <!-- Brand Plate -->
      <rect x="260" y="245" width="155" height="36" rx="6" fill="${accentColor}"/>
      <text x="337" y="268" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · BOCA 22</text>
      <!-- Switch -->
      <circle cx="300" cy="335" r="14" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5"/>
      <circle cx="345" cy="335" r="10" fill="#16A34A"/>
    `;
  }

  // 19. SERRA FITA INOX 2,82M
  if (upperName.includes('SERRA FITA') || upperName.includes('SERRA')) {
    return `
      <!-- Lower Motor Base Cabinet -->
      <rect x="265" y="305" width="250" height="130" rx="6" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Left Column & Upper Pulley Housing -->
      <rect x="265" y="102" width="75" height="205" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <rect x="265" y="95" width="215" height="110" rx="12" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Vertical 2.82m Band Saw Blade -->
      <line x1="445" y1="205" x2="445" y2="305" stroke="#DC2626" stroke-width="4"/>
      <rect x="438" y="205" width="14" height="38" fill="#0F172A"/>
      <!-- Sliding Cutting Table -->
      <rect x="235" y="292" width="330" height="16" rx="4" fill="#CBD5E1" stroke="#0F172A" stroke-width="3"/>
      <!-- Brand Badge -->
      <rect x="290" y="130" width="155" height="34" rx="5" fill="${accentColor}"/>
      <text x="367" y="152" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · 2,82M</text>
      <circle cx="320" cy="365" r="14" fill="#DC2626"/>
      <circle cx="360" cy="365" r="11" fill="#16A34A"/>
    `;
  }

  // 20. VITRINES EXPOSITORAS / CONFEITARIA / ESTUFA CONJUGADA
  if (upperName.includes('VITRINE')) {
    const isConjugada = upperName.includes('ESTUFA');
    const baseFill = isConjugada ? '#0F172A' : '#1E293B';
    return `
      <!-- Straight Tempered Glass Display Case -->
      <polygon points="175,135 625,135 645,330 155,330" fill="url(#glassGrad)" stroke="#334155" stroke-width="4"/>
      ${isConjugada ? '<line x1="400" y1="135" x2="400" y2="330" stroke="#0F172A" stroke-width="4"/>' : ''}
      <!-- Illuminated Shelves Inside -->
      <line x1="175" y1="198" x2="625" y2="198" stroke="#0F172A" stroke-width="3.5"/>
      <line x1="168" y1="262" x2="632" y2="262" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Warm Estufa Trays vs Confeitaria Displays -->
      ${
        isConjugada
          ? `<rect x="195" y="178" width="180" height="16" rx="3" fill="#F59E0B"/>
             <rect x="190" y="242" width="185" height="16" rx="3" fill="#D97706"/>
             <rect x="425" y="175" width="175" height="18" rx="4" fill="#38BDF8"/>
             <rect x="425" y="239" width="180" height="18" rx="4" fill="#0284C7"/>`
          : `<rect x="210" y="176" width="95" height="18" rx="4" fill="#F59E0B"/>
             <rect x="350" y="176" width="95" height="18" rx="4" fill="#EC4899"/>
             <rect x="490" y="176" width="95" height="18" rx="4" fill="#0284C7"/>`
      }
      <!-- Lower Refrigerated Base -->
      <rect x="155" y="330" width="490" height="98" rx="6" fill="${baseFill}" stroke="#0F172A" stroke-width="4"/>
      <rect x="185" y="358" width="165" height="36" rx="5" fill="${accentColor}"/>
      <text x="267" y="381" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <rect x="520" y="362" width="95" height="28" rx="4" fill="#0284C7"/>
      <text x="567" y="381" font-family="monospace" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">${isConjugada ? '65° / +4°C' : '+4.0 °C'}</text>
    `;
  }

  // 21. MESA / BANCADA INOX C/ CUBA
  if (upperName.includes('MESA') || upperName.includes('BANCADA')) {
    return `
      <!-- Rear Backsplash (Espelho Traseiro) -->
      <rect x="155" y="190" width="490" height="24" fill="#CBD5E1" stroke="#0F172A" stroke-width="3"/>
      <!-- Top Stainless Steel Worktop 1,80m -->
      <rect x="150" y="214" width="500" height="26" rx="3" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Deep Stamped Sink Basin (Cuba Inox) on Right -->
      <path d="M445 240 L605 240 L592 318 L458 318 Z" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3.5"/>
      <!-- Tubular Inox Legs & Braced Lower Shelf -->
      <line x1="175" y1="240" x2="175" y2="432" stroke="#475569" stroke-width="9"/>
      <line x1="625" y1="240" x2="625" y2="432" stroke="#475569" stroke-width="9"/>
      <rect x="175" y="375" width="450" height="14" fill="url(#inoxGrad)" stroke="#334155" stroke-width="2.5"/>
      <!-- Brand Plate -->
      <rect x="215" y="265" width="175" height="34" rx="5" fill="${accentColor}"/>
      <text x="302" y="287" font-family="sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand} · INOX 430</text>
    `;
  }

  // 22. BALANÇAS ELETRÔNICAS (PLATAFORMA 150KG vs COMPUTADORIZADA WI-FI)
  if (upperName.includes('BALANCA')) {
    const isPlatform150 = upperName.includes('150KG') || upperName.includes('50X50');
    if (isPlatform150) {
      return `
        <!-- 50x50cm Stainless Floor Platform -->
        <polygon points="215,375 495,375 525,425 185,425" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="4"/>
        <!-- Tall Column -->
        <rect x="465" y="155" width="22" height="225" fill="#94A3B8" stroke="#0F172A" stroke-width="3"/>
        <!-- Digital Indicator Head -->
        <rect x="395" y="108" width="160" height="68" rx="8" fill="#0F172A" stroke="#334155" stroke-width="3.5"/>
        <rect x="412" y="120" width="126" height="30" rx="4" fill="#064E3B"/>
        <text x="475" y="141" font-family="monospace" font-size="18" font-weight="800" fill="#34D399" text-anchor="middle">150.0 kg</text>
        <text x="475" y="166" font-family="sans-serif" font-size="10" font-weight="700" fill="#38BDF8" text-anchor="middle">${safeBrand} · ${safeRef}</text>
      `;
    }
    // Retail / Bakery Wi-Fi Scale with Label Printer (EDGE 33TW)
    return `
      <!-- Scale Body & Label Printer Slot -->
      <rect x="215" y="295" width="350" height="120" rx="12" fill="#0F172A" stroke="#334155" stroke-width="3.5"/>
      <!-- Stainless Weighing Platter -->
      <rect x="225" y="268" width="235" height="27" rx="5" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="3"/>
      <!-- Customer Pole Display -->
      <rect x="505" y="145" width="18" height="150" fill="#334155"/>
      <rect x="385" y="108" width="185" height="58" rx="8" fill="#0F172A" stroke="#0284C7" stroke-width="3"/>
      <text x="477" y="132" font-family="monospace" font-size="13" font-weight="700" fill="#38BDF8" text-anchor="middle">PESO: 1.250 kg</text>
      <text x="477" y="152" font-family="monospace" font-size="14" font-weight="800" fill="#34D399" text-anchor="middle">TOTAL R$ 42,90</text>
      <!-- Front Operator Panel & Thermal Label Output -->
      <rect x="240" y="318" width="175" height="72" rx="6" fill="#1E293B"/>
      <text x="327" y="346" font-family="sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
      <text x="327" y="368" font-family="monospace" font-size="11" font-weight="700" fill="#38BDF8" text-anchor="middle">WI-FI · 6/15/33KG</text>
      <!-- Thermal Barcode Label Peeking Out -->
      <rect x="455" y="322" width="85" height="65" rx="4" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2"/>
      <line x1="468" y1="342" x2="526" y2="342" stroke="#0F172A" stroke-width="4" stroke-dasharray="4 2"/>
      <line x1="468" y1="358" x2="526" y2="358" stroke="#0F172A" stroke-width="6" stroke-dasharray="3 3"/>
    `;
  }

  // DEFAULT INDUSTRIAL EQUIPMENT ILLUSTRATION
  return `
    <rect x="220" y="140" width="360" height="280" rx="12" fill="url(#inoxGrad)" stroke="#0F172A" stroke-width="4"/>
    <rect x="255" y="175" width="290" height="55" rx="6" fill="${accentColor}"/>
    <text x="400" y="210" font-family="sans-serif" font-size="18" font-weight="800" fill="#FFFFFF" text-anchor="middle">${safeBrand}</text>
    <rect x="255" y="250" width="290" height="135" rx="8" fill="#1E293B"/>
    <text x="400" y="320" font-family="monospace" font-size="16" font-weight="700" fill="#38BDF8" text-anchor="middle">REF: ${safeRef}</text>
  `;
}

/**
 * Generates a high-resolution, product-specific SVG studio photo Data URL
 * using the Product Name, Manufacturer Name, and Manufacturer Reference.
 */
export function generateProductSpecificPhoto(meta: ProductPhotoMetadata): string {
  const { cleanName, productCode, manufacturerRef, manufacturerName, cleanSpecs } =
    extractProductIdentity(meta);
  const theme = getBrandTheme(manufacturerName);
  const upperName = cleanName.toUpperCase();

  const artwork = renderEquipmentArtwork(
    upperName,
    manufacturerName,
    manufacturerRef,
    theme.accent
  );

  // Split product name into 1 or 2 balanced lines for the studio nameplate
  const words = cleanName.split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 38) {
      line1 = (line1 + ' ' + w).trim();
    } else {
      line2 = (line2 + ' ' + w).trim();
    }
  }
  if (line2.length > 44) {
    line2 = line2.slice(0, 41) + '...';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="studioBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="70%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
    <linearGradient id="inoxGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="45%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E0F2FE" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#BAE6FD" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#7DD3FC" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#studioBg)"/>
  <!-- Studio Floor Shadow -->
  <ellipse cx="400" cy="436" rx="260" ry="18" fill="#64748B" fill-opacity="0.28"/>

  <!-- Top Left: Manufacturer Brand Badge -->
  <rect x="32" y="24" width="235" height="44" rx="8" fill="${theme.badgeBg}"/>
  <text x="48" y="42" font-family="sans-serif" font-size="9" font-weight="700" fill="#CBD5E1" letter-spacing="1.2">FABRICANTE OFICIAL</text>
  <text x="48" y="59" font-family="sans-serif" font-size="15" font-weight="800" fill="${theme.badgeText}">${escapeXml(manufacturerName.slice(0, 18))}</text>

  <!-- Top Right: Manufacturer Reference & Code Badge -->
  <rect x="455" y="24" width="313" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
  <text x="472" y="42" font-family="monospace" font-size="10" font-weight="700" fill="#64748B">CÓD. PRODUTO: ${escapeXml(productCode.slice(0, 14))}</text>
  <text x="472" y="59" font-family="monospace" font-size="13" font-weight="800" fill="#0F172A">REF. FAB: ${escapeXml(manufacturerRef.slice(0, 20))}</text>

  <!-- Equipment Specific 3D-Styled Studio Artwork -->
  ${artwork}

  <!-- Bottom Product Identification Plate -->
  <rect x="32" y="472" width="736" height="104" rx="12" fill="#0F172A"/>
  <rect x="32" y="472" width="10" height="104" rx="4" fill="${theme.accent}"/>
  <text x="58" y="504" font-family="sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">${escapeXml(line1)}</text>
  <text x="58" y="528" font-family="sans-serif" font-size="15" font-weight="700" fill="#E2E8F0">${escapeXml(line2 || cleanSpecs)}</text>
  <text x="58" y="556" font-family="monospace" font-size="12" font-weight="600" fill="#38BDF8">FABRICANTE: ${escapeXml(manufacturerName)} · REF: ${escapeXml(manufacturerRef)} · ${escapeXml(cleanSpecs.slice(0, 34))}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a secondary technical datasheet image for the product's gallery.
 */
export function generateProductTechnicalSheetImage(meta: ProductPhotoMetadata): string {
  const { cleanName, productCode, manufacturerRef, manufacturerName, cleanSpecs } =
    extractProductIdentity(meta);
  const theme = getBrandTheme(manufacturerName);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="#0F172A"/>
  <rect x="36" y="36" width="728" height="528" rx="16" fill="#1E293B" stroke="#334155" stroke-width="2"/>
  <rect x="64" y="64" width="240" height="36" rx="6" fill="${theme.accent}"/>
  <text x="184" y="87" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">FICHA TÉCNICA DO FABRICANTE</text>

  <text x="64" y="142" font-family="sans-serif" font-size="22" font-weight="800" fill="#FFFFFF">${escapeXml(cleanName.slice(0, 42))}</text>
  <text x="64" y="172" font-family="sans-serif" font-size="17" font-weight="600" fill="#CBD5E1">${escapeXml(cleanName.slice(42, 84))}</text>

  <line x1="64" y1="200" x2="736" y2="200" stroke="#334155" stroke-width="2"/>

  <rect x="64" y="226" width="320" height="90" rx="10" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
  <text x="84" y="254" font-family="sans-serif" font-size="11" font-weight="700" fill="#94A3B8">FABRICANTE / MARCA</text>
  <text x="84" y="288" font-family="sans-serif" font-size="22" font-weight="800" fill="#38BDF8">${escapeXml(manufacturerName.slice(0, 20))}</text>

  <rect x="416" y="226" width="320" height="90" rx="10" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
  <text x="436" y="254" font-family="sans-serif" font-size="11" font-weight="700" fill="#94A3B8">REFERÊNCIA DO FABRICANTE</text>
  <text x="436" y="288" font-family="monospace" font-size="22" font-weight="800" fill="#FFFFFF">${escapeXml(manufacturerRef.slice(0, 18))}</text>

  <rect x="64" y="340" width="320" height="90" rx="10" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
  <text x="84" y="368" font-family="sans-serif" font-size="11" font-weight="700" fill="#94A3B8">CÓDIGO DO PRODUTO</text>
  <text x="84" y="402" font-family="monospace" font-size="22" font-weight="800" fill="#FBBF24">${escapeXml(productCode.slice(0, 18))}</text>

  <rect x="416" y="340" width="320" height="90" rx="10" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
  <text x="436" y="368" font-family="sans-serif" font-size="11" font-weight="700" fill="#94A3B8">ESPECIFICAÇÃO / DIMENSÕES</text>
  <text x="436" y="402" font-family="sans-serif" font-size="16" font-weight="700" fill="#E2E8F0">${escapeXml(cleanSpecs.slice(0, 26))}</text>

  <rect x="64" y="462" width="672" height="68" rx="10" fill="#0F172A"/>
  <text x="400" y="502" font-family="sans-serif" font-size="14" font-weight="700" fill="#34D399" text-anchor="middle">EQUIPAMENTO COMERCIAL HOMOLOGADO · GARANTIA DE FÁBRICA</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildProductGalleryFromMetadata(meta: ProductPhotoMetadata): {
  primaryImage: string;
  galleryImages: string[];
} {
  const primaryImage = generateProductSpecificPhoto(meta);
  const techSheetImage = generateProductTechnicalSheetImage(meta);
  return {
    primaryImage,
    galleryImages: [primaryImage, techSheetImage, SPEC_INOX_URL, SPEC_NR12_URL],
  };
}
