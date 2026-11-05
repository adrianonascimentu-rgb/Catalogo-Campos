import type { Timestamp } from './backend';

export const WORKSPACE_OWNER_ID = 'campos_workspace';
export const DEFAULT_COMPANY_LOGO = '/equipments/campos-logo.svg';

export type LeadStatus = 'novo' | 'em_atendimento' | 'proposta' | 'convertido';

export interface CompanySettings {
  id: string;
  ownerId: string;
  logoUrl: string;
  updatedAt: Timestamp;
}

export interface Seller {
  id: string;
  ownerId: string;
  name: string;
  roleTitle: string;
  whatsapp: string;
  slug: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Segment {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: string;
  ownerId: string;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Lead {
  id: string;
  ownerId: string;
  sellerId: string;
  sellerName: string;
  clientName: string;
  clientPhone: string;
  status: LeadStatus;
  totalViews: number;
  lastViewedProductName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  clientUid: string;
}

export interface ProductView {
  id: string;
  ownerId: string;
  leadId: string;
  sellerId: string;
  productId: string;
  productName: string;
  productCategory: string;
  productPrice: number;
  productImage: string;
  viewCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkspacePermissions {
  id: string;
  ownerId: string;
  // Permissões de visualização dos Clientes no link compartilhado
  clientShowPrices: boolean;
  clientShowProductCode: boolean;
  clientShowManufacturerRef: boolean;
  clientShowDimensionsAndMaterial: boolean;
  clientShowPhotosCount: boolean;
  clientHideOutOfStock: boolean;
  clientShowWhatsappButton: boolean;
  clientRequireIdentification: boolean;
  // Permissões de edição e ação dos Vendedores no painel interno
  sellerCanEditProducts: boolean;
  sellerCanEditPrices: boolean;
  sellerCanCreateOrDeleteProducts: boolean;
  sellerCanManagePhotos: boolean;
  sellerCanManageSegments: boolean;
  sellerCanManageSellers: boolean;
  sellerCanDeleteLeads: boolean;
  sellerCanViewPdfTable: boolean;
  sellerCanChangeLogo: boolean;
  updatedAt: Timestamp;
}

export type StaffRole = 'seller' | 'collaborator';

export interface StaffMember {
  id: string; // e-mail em minúsculas (ID do documento em /staff/{email})
  ownerId: string;
  name: string;
  roleLabel: string;
  role: StaffRole;
  sellerId: string;
  active: boolean;
  canManagePhotos: boolean;
  canEditProducts: boolean;
  canCreateOrDeleteProducts: boolean;
  canManageSegments: boolean;
  canEditPrices: boolean;
  canManageSellers: boolean;
  canDeleteLeads: boolean;
  canChangeLogo: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const VALIDATION_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  LOGO_URL_MAX: 350000,
  SELLER_NAME_MAX: 80,
  SELLER_ROLE_MAX: 80,
  SELLER_WHATSAPP_MAX: 30,
  SELLER_SLUG_MAX: 60,
  SEGMENT_NAME_MAX: 60,
  SEGMENT_SLUG_MAX: 60,
  SEGMENT_DESC_MAX: 300,
  PRODUCT_SKU_MAX: 40,
  PRODUCT_NAME_MAX: 120,
  PRODUCT_CATEGORY_MAX: 300,
  PRODUCT_DESC_MAX: 1000,
  PRODUCT_DIM_MAX: 120,
  PRODUCT_MAT_MAX: 120,
  PRODUCT_IMG_MAX: 350000,
  PRODUCT_GALLERY_MAX: 6,
  LEAD_NAME_MAX: 100,
  LEAD_PHONE_MAX: 30,
  STAFF_EMAIL_MIN: 5,
  STAFF_EMAIL_MAX: 128,
  STAFF_NAME_MAX: 80,
  STAFF_ROLE_MAX: 80,
};
