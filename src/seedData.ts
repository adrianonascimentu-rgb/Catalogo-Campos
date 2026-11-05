import { buildProductGalleryFromMetadata } from './productPhotoGenerator';

export const IMG_PANIFICACAO = '/equipments/panificacao.svg';
export const IMG_REFRIGERACAO = '/equipments/refrigeracao.svg';
export const IMG_VITRINE = '/equipments/vitrine.svg';
export const IMG_COCCAO = '/equipments/coccao.svg';
export const IMG_ACOUGUE = '/equipments/acougue.svg';
export const IMG_BALANCA = '/equipments/balanca.svg';
export const IMG_SPEC_INOX = '/equipments/spec-inox.svg';
export const IMG_SPEC_NR12 = '/equipments/spec-nr12.svg';

export const HERO_SHOWCASE_IMAGE = IMG_REFRIGERACAO;

export interface SeedSeller {
  id: string;
  name: string;
  roleTitle: string;
  whatsapp: string;
  slug: string;
  active: boolean;
}

export interface SeedSegment {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
}

export interface SeedProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  description: string;
  dimensions: string;
  material: string;
  primaryImage: string;
  galleryImages: string[];
  inStock: boolean;
}

export const INITIAL_SELLERS: SeedSeller[] = [];

export const INITIAL_SEGMENTS: SeedSegment[] = [
  {
    id: 'seg_refrigeracao',
    name: 'Refrigeração & Cervejeiras',
    slug: 'refrigeracao-cervejeiras',
    description:
      'Auto serviços refrigerados, cervejeiras, freezers horizontais, ilhas de congelados e balcões refrigerados para supermercados e conveniências.',
    coverImage: IMG_REFRIGERACAO,
  },
  {
    id: 'seg_panificacao',
    name: 'Panificação & Confeitaria',
    slug: 'panificacao-confeitaria',
    description:
      'Amassadeiras espirais e rápidas, cilindros laminadores, divisoras, modeladoras, fornos turbo e câmaras de fermentação para padarias.',
    coverImage: IMG_PANIFICACAO,
  },
  {
    id: 'seg_acougue',
    name: 'Açougue & Frios',
    slug: 'acougue-frios',
    description:
      'Amaciadores de carne, cortadores de frios, picadores de carne, serras fita em inox e balcões frigoríficos tendal.',
    coverImage: IMG_ACOUGUE,
  },
  {
    id: 'seg_coccao',
    name: 'Cocção, Fogões & Fornos',
    slug: 'coccao-fogoes-fornos',
    description:
      'Fogões industriais de alta pressão, chapas bifeteiras, fritadeiras elétricas e a gás, assadores rotativos e fornos industriais.',
    coverImage: IMG_COCCAO,
  },
  {
    id: 'seg_vitrines',
    name: 'Vitrines & Expositores',
    slug: 'vitrines-expositores',
    description:
      'Vitrines refrigeradas para doces e confeitaria, estufas aquecidas para salgados e expositores com vidro curvo ou reto.',
    coverImage: IMG_VITRINE,
  },
  {
    id: 'seg_balancas',
    name: 'Balanças & Mobiliário Inox',
    slug: 'balancas-mobiliario-inox',
    description:
      'Balanças eletrônicas comerciais e de plataforma, liquidificadores industriais, raladores e bancadas em aço inox.',
    coverImage: IMG_BALANCA,
  },
];

const RAW_INITIAL_PRODUCTS: SeedProduct[] = [
  // PÁGINA 1 - AMACIADORES, AMASSADEIRAS, AUTO SERVIÇO, BALANÇAS, BALCÕES
  {
    id: 'prod_2994',
    sku: 'CÓD 2994 · PAC220M60N5',
    name: 'AMACIADOR DE CARNE PAC 1/2 CV 220V VISA',
    category: 'Açougue & Frios',
    price: 3654.0,
    description:
      'Amaciador de carnes profissional Visa com motor de 1/2 CV 220V. Estrutura em aço inox de fácil higienização e segurança operacional para açougues, restaurantes e cozinhas industriais. Estoque tabela: 1 un.',
    dimensions: 'Cód. Fab: PAC220M60N5 · 220V · 1/2 CV',
    material: 'Fabricante: VISA · Aço Inox',
    primaryImage: IMG_ACOUGUE,
    galleryImages: [IMG_ACOUGUE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_181498',
    sku: 'CÓD 181498 · 90809-35831',
    name: 'AMASSADEIRA ESPIRAL AE-25 380V G PANIZ',
    category: 'Panificação & Confeitaria',
    price: 21385.0,
    description:
      'Amassadeira espiral profissional G Paniz AE-25 trifásica 380V para 25kg de massa pronta. Ideal para padarias, pizzarias e indústrias de panificação de alta demanda, com grade de proteção NR12.',
    dimensions: 'Cód. Fab: 90809-35831 · Cap. 25kg · 380V',
    material: 'Fabricante: G PANIZ · Cuba Aço Inox',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212316',
    sku: 'CÓD 212316 · AR-25-1B16095',
    name: 'AMASSADEIRA RAPIDA AR-25 BRAESI',
    category: 'Panificação & Confeitaria',
    price: 9871.0,
    description:
      'Amassadeira rápida Braesi AR-25 de alto desempenho para preparo ágil de massas de pães, pizzas e biscoitos. Cuba em aço inox e sistema de segurança conforme norma NR12.',
    dimensions: 'Cód. Fab: AR-25-1B16095 · Cap. 25kg',
    material: 'Fabricante: BRAESI · Aço Inox',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_188899',
    sku: 'CÓD 188899 · ACFM1220-2V000',
    name: 'AUTO SERVICO 2,00M AR FORCADO PRETO FRICON',
    category: 'Refrigeração & Cervejeiras',
    price: 15961.0,
    description:
      'Expositor refrigerado vertical Auto Serviço 2,00m Fricon com refrigeração por ar forçado, acabamento preto, portas de vidro duplo antiembaçante e controlador eletrônico digital.',
    dimensions: 'Cód. Fab: ACFM1220-2V000 · Largura 2,00m',
    material: 'Fabricante: FRICON · Ar Forçado Preto',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_178993',
    sku: 'CÓD 178993 · ACFM2375-2V000',
    name: 'AUTO SERVICO 3,00M AR FORCADO PT B EMI CINZA FRIC',
    category: 'Refrigeração & Cervejeiras',
    price: 20315.0,
    description:
      'Expositor Auto Serviço 3,00m Fricon com sistema de ar forçado, portas de vidro baixa emissividade (Low-E) e amplo volume interno para supermercados, conveniências e laticínios.',
    dimensions: 'Cód. Fab: ACFM2375-2V000 · Largura 3,00m',
    material: 'Fabricante: FRICON · Cinza / Vidro Low-E',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212296',
    sku: 'CÓD 212296 · K-150IB-3-S',
    name: 'BALANCA ELETR 150KG PLAT 50X50 INOX K-150IB BALMAK',
    category: 'Balanças & Mobiliário Inox',
    price: 1715.0,
    description:
      'Balança eletrônica de piso/bancada Balmak linha K-150IB com capacidade para 150kg e plataforma 50x50cm em aço inoxidável. Homologada pelo Inmetro para recebimento e expedição.',
    dimensions: 'Cód. Fab: K-150IB-3-S · Plat. 50x50cm · 150kg',
    material: 'Fabricante: BALMAK · Plataforma Aço Inox',
    primaryImage: IMG_BALANCA,
    galleryImages: [IMG_BALANCA, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212632',
    sku: 'CÓD 212632 · PA2647',
    name: 'BALANCA ELETR 6/15/33KG EDGE33TW WI-FI BALMAK',
    category: 'Balanças & Mobiliário Inox',
    price: 5396.0,
    description:
      'Balança computadorizada com impressora térmica integrada Balmak EDGE 33TW Wi-Fi com tripla escala (6/15/33kg) para rotulagem de peso, preço e código de barras em supermercados e padarias.',
    dimensions: 'Cód. Fab: PA2647 · Tripla Escala 6/15/33kg · Wi-Fi',
    material: 'Fabricante: BALMAK · Automação Comercial',
    primaryImage: IMG_BALANCA,
    galleryImages: [IMG_BALANCA, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 2 - BATEDEIRAS, BEBEDOUROS, BUFFETS, CAFETEIRAS, CERVEJEIRAS, CHAPAS
  {
    id: 'prod_181510',
    sku: 'CÓD 181510 · 90586-14523',
    name: 'BATEDEIRA PLANETARIA BP12RP 220V 1/2CV G PANIZ',
    category: 'Panificação & Confeitaria',
    price: 8783.0,
    description:
      'Batedeira planetária industrial G Paniz BP12RP de 12 litros com motor 1/2 CV 220V e variação de velocidade. Acompanha batedores globo, raquete e espiral para confeitaria profissional.',
    dimensions: 'Cód. Fab: 90586-14523 · 12 Litros · 220V 1/2CV',
    material: 'Fabricante: G PANIZ · Cuba Inox',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212311',
    sku: 'CÓD 212311 · 20000164',
    name: 'BEBEDOURO IND 3 TORNEIRAS 100L INOX FRISBEL',
    category: 'Refrigeração & Cervejeiras',
    price: 3311.0,
    description:
      'Bebedouro industrial de coluna Frisbel com reservatório de 100 litros, 3 torneiras de alta vazão, gabinete em aço inox e gás ecológico com refrigeração rápida para alto fluxo de pessoas.',
    dimensions: 'Cód. Fab: 20000164 · 100 Litros · 3 Torneiras',
    material: 'Fabricante: FRISBEL · Aço Inox',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_189711',
    sku: 'CÓD 189711 · BBMM-12-220V',
    name: 'BUFFET TERM 12 CB ELET TAMPA VD EDANCA',
    category: 'Cocção, Fornos & Buffets',
    price: 5028.0,
    description:
      'Buffet térmico elétrico Edanca com 12 cubas gastronômicas (GN), protetor salivador em vidro temperado curvo, termostato regulável e estrutura tubular reforçada para restaurantes self-service.',
    dimensions: 'Cód. Fab: BBMM-12-220V · 12 Cubas · 220V',
    material: 'Fabricante: EDANCA · Inox & Vidro Temperado',
    primaryImage: IMG_VITRINE,
    galleryImages: [IMG_VITRINE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_189010',
    sku: 'CÓD 189010 · CF.4.422',
    name: 'CAFETEIRA 8L PROFISSIONAL CAFE/LEITE 2X4 MARCHESO',
    category: 'Cocção, Fornos & Buffets',
    price: 2305.0,
    description:
      'Cafeteira elétrica profissional Marchesoni modelo 2x4 (dois reservatórios de 4 litros para café e leite) aquecida em banho-maria com corpo em aço inox 304 e termostato ajustável.',
    dimensions: 'Cód. Fab: CF.4.422 · 8 Litros (2x4L)',
    material: 'Fabricante: MARCHESONI · Aço Inox 304',
    primaryImage: IMG_COCCAO,
    galleryImages: [IMG_COCCAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_211336',
    sku: 'CÓD 211336 · VCFC569-2D000',
    name: 'CERVEJEIRA 569L -6/-4 PORTA DE CHAPA/VIDRO FRICON',
    category: 'Refrigeração & Cervejeiras',
    price: 7141.0,
    description:
      'Cervejeira vertical Fricon 569 litros com faixa de temperatura de -6°C a -4°C, porta mista de chapa com visor de vidro antiembaçante, degelo automático Frost Free e prateleiras reguláveis.',
    dimensions: 'Cód. Fab: VCFC569-2D000 · 569 Litros · -6°C a -4°C',
    material: 'Fabricante: FRICON · Porta Chapa/Vidro',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_190212',
    sku: 'CÓD 190212 · CFGL10',
    name: 'CHAPA BIFETEIRA A GAS 1,00M LEVE VISA',
    category: 'Cocção, Fornos & Buffets',
    price: 1578.0,
    description:
      'Chapa bifeteira profissional a gás de 1,00 metro Visa com queimadores tubulares bem distribuídos, gaveta coletora de resíduos e superfície de fritura uniforme para lanchonetes e hamburguerias.',
    dimensions: 'Cód. Fab: CFGL10 · Largura 1,00m · A Gás',
    material: 'Fabricante: VISA · Aço Carbono & Inox',
    primaryImage: IMG_COCCAO,
    galleryImages: [IMG_COCCAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 3 - CILINDROS, CORTADORES DE FRIOS, CUTTERS
  {
    id: 'prod_189227',
    sku: 'CÓD 189227 · CLI390-9344G',
    name: 'CILINDRO ELETRICO CLI390 1/2CV 220V GASTROMAQ',
    category: 'Panificação & Confeitaria',
    price: 7742.0,
    description:
      'Cilindro laminador elétrico Gastromaq CLI390 com rolos de 39cm em aço inox, motor de 1/2 CV 220V e sistema completo de segurança NR12 para laminação de massas de pães e pastéis.',
    dimensions: 'Cód. Fab: CLI390-9344G · Rolos 390mm · 1/2CV',
    material: 'Fabricante: GASTROMAQ · Rolos em Inox',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_160601',
    sku: 'CÓD 160601 · BM18NRPF',
    name: 'CORTADOR DE FRIOS AUT INOX 300MM BM18 BERMAR',
    category: 'Açougue & Frios',
    price: 9353.0,
    description:
      'Cortador e fatiador de frios automático Bermar BM18 com lâmina de 300mm, construção em aço inoxidável e conformidade integral com a norma NR12 para padarias e supermercados.',
    dimensions: 'Cód. Fab: BM18NRPF · Lâmina 300mm Automático',
    material: 'Fabricante: BERMAR · Aço Inox NR12',
    primaryImage: IMG_ACOUGUE,
    galleryImages: [IMG_ACOUGUE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 4 & 5 - EXPOSITORES DE CARNE, FOGÕES INDUSTRIAIS, FORNOS
  {
    id: 'prod_311736',
    sku: 'CÓD 311736 · 050200B095',
    name: 'EXPOSITOR VERT P/CARNE 3 PORTAS 1,90M PT POLAR',
    category: 'Refrigeração & Cervejeiras',
    price: 12997.0,
    description:
      'Expositor vertical para carnes Polar de 1,90m com 3 portas de vidro, acabamento preto, iluminação LED interna e sistema de refrigeração dimensionado para conservação de cortes.',
    dimensions: 'Cód. Fab: 050200B095 · 1,90m · 3 Portas',
    material: 'Fabricante: POLAR · Linha Açougue Preto',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212256',
    sku: 'CÓD 212256 · VAPI627446',
    name: 'FOGAO IND 6BC 6BS ALTA PRESSAO INOX VENANCIO',
    category: 'Cocção, Fornos & Buffets',
    price: 3056.0,
    description:
      'Fogão industrial Venâncio de 6 bocas em alta pressão com estrutura em aço inox, grelhas em ferro fundido e bandeja coletora para cozinhas de restaurantes, hotéis e refeitórios.',
    dimensions: 'Cód. Fab: VAPI627446 · 6 Bocas Alta Pressão',
    material: 'Fabricante: VENANCIO · Aço Inox & Ferro Fundido',
    primaryImage: IMG_COCCAO,
    galleryImages: [IMG_COCCAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_188475',
    sku: 'CÓD 188475 · FIRI11015560',
    name: 'FORNO IND GAS INOX 110 ROMA VENANCIO',
    category: 'Cocção, Fornos & Buffets',
    price: 4281.0,
    description:
      'Forno industrial a gás Venâncio linha Roma 110 em aço inox com isolamento térmico em lã de rocha, pedras refratárias que armazenam o calor e cavalete reforçado.',
    dimensions: 'Cód. Fab: FIRI11015560 · Câmara 110 · A Gás',
    material: 'Fabricante: VENANCIO · Aço Inox & Refratário',
    primaryImage: IMG_COCCAO,
    galleryImages: [IMG_COCCAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 6 - FORNOS TURBO, FREEZERS, FRITADORES
  {
    id: 'prod_176400',
    sku: 'CÓD 176400 · PRP-10000ST36256',
    name: 'FORNO TURBO A GAS 10 TELAS PRP-10000 STYLE PROGAS',
    category: 'Panificação & Confeitaria',
    price: 11933.0,
    description:
      'Forno turbo a gás Progás PRP-10000 Style para 10 esteiras (58x70cm) com painel digital controlador de tempo, temperatura e vapor. Assamento uniforme de alta produtividade para padarias.',
    dimensions: 'Cód. Fab: PRP-10000ST36256 · 10 Telas A Gás',
    material: 'Fabricante: PROGAS · Linha Style Profissional',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212723',
    sku: 'CÓD 212723 · FVT10E-57390',
    name: 'FORNO TURBO ELETRICO 10 TELAS TWISTER FVT10E VENAN',
    category: 'Panificação & Confeitaria',
    price: 10900.0,
    description:
      'Forno turbo elétrico Venâncio Twister FVT10E para 10 esteiras com circulação de ar forçado por turbina, injeção de vapor programável e porta com vidro temperado duplo.',
    dimensions: 'Cód. Fab: FVT10E-57390 · 10 Telas Elétrico',
    material: 'Fabricante: VENANCIO · Linha Twister',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_211910',
    sku: 'CÓD 211910 · HCED503-2V999',
    name: 'FREEZER HORIZ EXPOSITOR 503L FRICON DUPLA ACAO',
    category: 'Refrigeração & Cervejeiras',
    price: 4716.0,
    description:
      'Freezer horizontal expositor Fricon de 503 litros com dupla ação (conservador de congelados ou refrigerador), tampas de vidro deslizantes de baixa emissividade e dreno frontal.',
    dimensions: 'Cód. Fab: HCED503-2V999 · 503 Litros Dupla Ação',
    material: 'Fabricante: FRICON · Tampas de Vidro',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_166278',
    sku: 'CÓD 166278 · FT.2.252.G',
    name: 'FRITADOR ELETRICO AGUA/OLEO 25L MARCHESONI',
    category: 'Cocção, Fornos & Buffets',
    price: 2128.0,
    description:
      'Fritador elétrico industrial sistema água e óleo Marchesoni de 25 litros com pedestal, cuba em aço inox 304, termostato de precisão e zona fria que evita queima de resíduos.',
    dimensions: 'Cód. Fab: FT.2.252.G · 25 Litros Água/Óleo',
    material: 'Fabricante: MARCHESONI · Cuba Inox 304',
    primaryImage: IMG_COCCAO,
    galleryImages: [IMG_COCCAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 7 & 8 - ILHAS, LIQUIDIFICADORES, MESAS INOX, MODELADORAS, PICADORES
  {
    id: 'prod_212317',
    sku: 'CÓD 212317 · ICED1163-2V016',
    name: 'ILHA HORIZ BAIXA TEMP 1163L 3,00M PRETA LED FRICON',
    category: 'Refrigeração & Cervejeiras',
    price: 12180.0,
    description:
      'Ilha horizontal de congelados e resfriados Fricon de 3,00 metros e 1.163 litros na cor preta com iluminação interna em LED, tampas de vidro temperado e controlador eletrônico.',
    dimensions: 'Cód. Fab: ICED1163-2V016 · 3,00m · 1163 Litros',
    material: 'Fabricante: FRICON · Preta c/ Iluminação LED',
    primaryImage: IMG_REFRIGERACAO,
    galleryImages: [IMG_REFRIGERACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_189001',
    sku: 'CÓD 189001 · 500116',
    name: 'MESA C/CUBA INOX 430 1,80X0,70X0,85 CIMAPI',
    category: 'Balanças & Mobiliário Inox',
    price: 4575.0,
    description:
      'Bancada de manipulação em aço inox 430 Cimapi com cuba estampada integrada, medidas de 1,80 x 0,70 x 0,85m, espelho traseiro e estrutura reforçada para cozinhas e açougues.',
    dimensions: 'Cód. Fab: 500116 · 1,80 x 0,70 x 0,85m',
    material: 'Fabricante: CIMAPI · Aço Inox 430 c/ Cuba',
    primaryImage: IMG_BALANCA,
    galleryImages: [IMG_BALANCA, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_183628',
    sku: 'CÓD 183628 · MB-35-B18215',
    name: 'MODELADORA DE PAO MB-35 C/NR12 BRAESI',
    category: 'Panificação & Confeitaria',
    price: 7621.0,
    description:
      'Modeladora de pães Braesi MB-35 de 35cm com cavalete, feltro em pura lã, troca rápida de correias e chave de segurança NR12 para modelagem padronizada de pães franceses e caseiros.',
    dimensions: 'Cód. Fab: MB-35-B18215 · 35cm · NR12',
    material: 'Fabricante: BRAESI · Panificação Profissional',
    primaryImage: IMG_PANIFICACAO,
    galleryImages: [IMG_PANIFICACAO, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_163228',
    sku: 'CÓD 163228 · PCI22220M60N5',
    name: 'PICADOR CARNE BOCA 22 INOX 1CV VISA',
    category: 'Açougue & Frios',
    price: 6539.0,
    description:
      'Moedor e picador de carnes profissional Visa Boca 22 em aço inox com motor potente de 1 CV 220V, bandeja de alimentação com bocal de segurança e engrenagens helicoidais em banho de óleo.',
    dimensions: 'Cód. Fab: PCI22220M60N5 · Boca 22 · 1 CV',
    material: 'Fabricante: VISA · Aço Inox',
    primaryImage: IMG_ACOUGUE,
    galleryImages: [IMG_ACOUGUE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  // PÁGINA 9 & 10 - SERRAS FITA, VITRINES REFRIGERADAS
  {
    id: 'prod_211533',
    sku: 'CÓD 211533 · BM150L',
    name: 'SERRA FITA 2,82M INOX BM150L 2HP BERMAR',
    category: 'Açougue & Frios',
    price: 12811.0,
    description:
      'Serra fita para ossos e carnes congeladas Bermar BM150L construída em aço inox com lâmina de 2,82m, motor de 2 HP, mesa móvel deslizante e dispositivos de proteção.',
    dimensions: 'Cód. Fab: BM150L · Fita 2,82m · Motor 2 HP',
    material: 'Fabricante: BERMAR · Aço Inox Integral',
    primaryImage: IMG_ACOUGUE,
    galleryImages: [IMG_ACOUGUE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_211024',
    sku: 'CÓD 211024 · 47253',
    name: 'VITRINE LUXO REFR. CONFEITARIA 1,20M VD RETO',
    category: 'Vitrines & Expositores',
    price: 8521.0,
    description:
      'Vitrine refrigerada linha Luxo Iglu de 1,20m com vidro reto temperado, iluminação LED por prateleira, revestimento interno em aço inox e controle digital para doces, bolos e confeitaria.',
    dimensions: 'Cód. Fab: 47253 · Largura 1,20m · Vidro Reto',
    material: 'Fabricante: IGLU · Linha Luxo Confeitaria',
    primaryImage: IMG_VITRINE,
    galleryImages: [IMG_VITRINE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_212535',
    sku: 'CÓD 212535 · 47126',
    name: 'VITRINE LUXO AR FORCADO 1,50M VD RETO IGLU',
    category: 'Vitrines & Expositores',
    price: 12248.0,
    description:
      'Vitrine expositora refrigerada por ar forçado Iglu Linha Luxo de 1,50m com vidro reto, degelo automático e distribuição homogênea de frio para padarias e delicatessens.',
    dimensions: 'Cód. Fab: 47126 · Largura 1,50m · Ar Forçado',
    material: 'Fabricante: IGLU · Vidro Reto Temperado',
    primaryImage: IMG_VITRINE,
    galleryImages: [IMG_VITRINE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
  {
    id: 'prod_211810',
    sku: 'CÓD 211810 · PVERT-150',
    name: 'VITRINE ESTUFA E CONFEITARIA 1,50M VD RETO PT POLA',
    category: 'Vitrines & Expositores',
    price: 9110.0,
    description:
      'Vitrine conjugada Estufa e Confeitaria Refrigerada Polar de 1,50m com vidro reto e acabamento preto Platinum, permitindo expor salgados aquecidos e doces refrigerados no mesmo módulo.',
    dimensions: 'Cód. Fab: PVERT-150 · 1,50m Conjugada',
    material: 'Fabricante: POLAR · Linha Platinum Preta',
    primaryImage: IMG_VITRINE,
    galleryImages: [IMG_VITRINE, IMG_SPEC_INOX, IMG_SPEC_NR12],
    inStock: true,
  },
];

export const INITIAL_PRODUCTS: SeedProduct[] = RAW_INITIAL_PRODUCTS.map((p) => {
  const { primaryImage, galleryImages } = buildProductGalleryFromMetadata({
    name: p.name,
    sku: p.sku,
    dimensions: p.dimensions,
    material: p.material,
    category: p.category,
  });
  return {
    ...p,
    primaryImage,
    galleryImages,
  };
});

