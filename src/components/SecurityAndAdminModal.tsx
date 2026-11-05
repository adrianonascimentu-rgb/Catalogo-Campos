import React, { useState } from 'react';
import { EmailLoginForm } from './EmailLoginForm';
import {
  Shield,
  Lock,
  Eye,
  Check,
  Users,
  UserPlus,
  Tag,
  Camera,
  Pencil,
  Trash2,
  FileText,
  Upload,
  LogOut,
  Copy,
  Mail,
} from 'lucide-react';
import {
  WorkspacePermissions,
  StaffMember,
  StaffRole,
  Seller,
  DEFAULT_COMPANY_LOGO,
} from '../types';

export type StaffPermissionKey =
  | 'canManagePhotos'
  | 'canEditProducts'
  | 'canCreateOrDeleteProducts'
  | 'canManageSegments'
  | 'canEditPrices'
  | 'canManageSellers'
  | 'canDeleteLeads'
  | 'canChangeLogo';

// Keep alias for compatibility
export type CollaboratorPermissionKey = StaffPermissionKey;

export type SellerPermissionPreset =
  | 'somente_vendas'
  | 'fotos_desc'
  | 'catalogo_completo'
  | 'acesso_total';

export interface NewStaffMemberPayload {
  email: string;
  name: string;
  roleLabel: string;
  role: StaffRole;
  sellerId: string;
  canManagePhotos: boolean;
  canEditProducts: boolean;
  canCreateOrDeleteProducts: boolean;
  canManageSegments: boolean;
  canEditPrices: boolean;
  canManageSellers: boolean;
  canDeleteLeads: boolean;
  canChangeLogo: boolean;
}

export interface NewSellerWithPermissionsPayload {
  email: string;
  name: string;
  roleTitle: string;
  whatsapp: string;
  canManagePhotos: boolean;
  canEditProducts: boolean;
  canCreateOrDeleteProducts: boolean;
  canManageSegments: boolean;
  canEditPrices: boolean;
  canManageSellers: boolean;
  canDeleteLeads: boolean;
  canChangeLogo: boolean;
}

interface SecurityTabViewProps {
  isAdminAuthenticated: boolean;
  adminEmail: string;
  sellers: Seller[];
  staffMembers: StaffMember[];
  onSaveStaffMember: (payload: NewStaffMemberPayload) => Promise<void>;
  onToggleStaffPermission: (member: StaffMember, key: StaffPermissionKey) => Promise<void>;
  onSetStaffPermissionPreset: (
    member: StaffMember,
    preset: SellerPermissionPreset
  ) => Promise<void>;
  onToggleStaffActive: (member: StaffMember) => Promise<void>;
  onDeleteStaffMember: (member: StaffMember) => Promise<void>;
  permissions: Omit<WorkspacePermissions, 'updatedAt'>;
  permSaveMessage: string | null;
  permSaveError?: string | null;
  handleTogglePermissionKey: (
    key: keyof Omit<WorkspacePermissions, 'id' | 'ownerId' | 'updatedAt'>
  ) => Promise<void>;
  savePermissionsDocument: (
    partial: Partial<Omit<WorkspacePermissions, 'id' | 'updatedAt'>>,
    feedbackMsg?: string
  ) => Promise<void>;
  handleAdminLogout: () => Promise<void>;
  appPublicUrl: string;
}

export const STAFF_PERMISSION_META: {
  key: StaffPermissionKey;
  shortLabel: string;
  title: string;
  description: string;
}[] = [
  {
    key: 'canManagePhotos',
    shortLabel: 'Incluir & Editar Fotos',
    title: 'Incluir, alterar e organizar fotos dos produtos',
    description:
      'Permite enviar fotos do celular/computador e organizar a galeria de cada equipamento.',
  },
  {
    key: 'canEditProducts',
    shortLabel: 'Descrição & Ficha Técnica',
    title: 'Adicionar e modificar descrição, nome, código, referência, dimensões e estoque',
    description:
      'Libera o botão "Editar Cadastro" para complementar descrições comerciais e especificações.',
  },
  {
    key: 'canCreateOrDeleteProducts',
    shortLabel: 'Cadastrar / Excluir Produtos',
    title: 'Cadastrar novos produtos ou excluir equipamentos',
    description:
      'Autoriza incluir novos itens no catálogo ou remover itens descontinuados.',
  },
  {
    key: 'canManageSegments',
    shortLabel: 'Segmentos do Catálogo',
    title: 'Criar/editar segmentos e marcar a qual segmento cada produto pertence',
    description:
      'Autoriza organizar os equipamentos por segmento (Padaria, Açougue, Refrigeração, etc.).',
  },
  {
    key: 'canEditPrices',
    shortLabel: 'Alterar Preços PB-10X',
    title: 'Alterar preços da tabela PB-10X (R$)',
    description:
      'Se desmarcado, o usuário pode editar a descrição e as fotos do produto sem conseguir mexer no preço.',
  },
  {
    key: 'canManageSellers',
    shortLabel: 'Gerenciar Vendedores',
    title: 'Cadastrar, ativar/inativar ou excluir vendedores',
    description: 'Autoriza administrar a lista de vendedores e seus links.',
  },
  {
    key: 'canDeleteLeads',
    shortLabel: 'Excluir Leads',
    title: 'Excluir leads capturados no CRM',
    description: 'Autoriza remover registros de leads na aba Leads & Acessos.',
  },
  {
    key: 'canChangeLogo',
    shortLabel: 'Alterar Logomarca',
    title: 'Alterar a logomarca da empresa no topo',
    description: 'Autoriza enviar ou trocar a logomarca institucional.',
  },
];

export const SecurityTabView: React.FC<SecurityTabViewProps> = ({
  isAdminAuthenticated,
  adminEmail,
  sellers,
  staffMembers,
  onSaveStaffMember,
  onToggleStaffPermission,
  onSetStaffPermissionPreset,
  onToggleStaffActive,
  onDeleteStaffMember,
  permissions,
  permSaveMessage,
  permSaveError,
  handleTogglePermissionKey,
  savePermissionsDocument,
  handleAdminLogout,
  appPublicUrl,
}) => {
  // Team member registration state (/staff/{email})
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('seller');
  const [staffSellerId, setStaffSellerId] = useState<string>('');
  const [staffRoleLabel, setStaffRoleLabel] = useState('Consultor Comercial');
  const [staffPerms, setStaffPerms] = useState<Record<StaffPermissionKey, boolean>>({
    canManagePhotos: true,
    canEditProducts: true,
    canCreateOrDeleteProducts: false,
    canManageSegments: false,
    canEditPrices: false,
    canManageSellers: false,
    canDeleteLeads: false,
    canChangeLogo: false,
  });
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [staffFormSuccess, setStaffFormSuccess] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);

  // Only the Administrator sees and uses this screen
  if (!isAdminAuthenticated) {
    return null;
  }

  const applyStaffPreset = (
    preset: 'somente_vendas' | 'fotos_desc' | 'catalogo_completo' | 'gerente_total'
  ) => {
    if (preset === 'somente_vendas') {
      if (staffRole === 'collaborator') {
        setStaffRoleLabel('Auxiliar de Atendimento');
      } else {
        setStaffRoleLabel('Consultor Comercial');
      }
      setStaffPerms({
        canManagePhotos: false,
        canEditProducts: false,
        canCreateOrDeleteProducts: false,
        canManageSegments: false,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      });
    } else if (preset === 'fotos_desc') {
      setStaffRoleLabel(
        staffRole === 'seller' ? 'Consultor Comercial' : 'Auxiliar de Fotos & Descrições'
      );
      setStaffPerms({
        canManagePhotos: true,
        canEditProducts: true,
        canCreateOrDeleteProducts: false,
        canManageSegments: false,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      });
    } else if (preset === 'catalogo_completo') {
      setStaffRoleLabel(
        staffRole === 'seller' ? 'Consultor Comercial Sênior' : 'Auxiliar de Catálogo & Produtos'
      );
      setStaffPerms({
        canManagePhotos: true,
        canEditProducts: true,
        canCreateOrDeleteProducts: true,
        canManageSegments: true,
        canEditPrices: false,
        canManageSellers: false,
        canDeleteLeads: false,
        canChangeLogo: false,
      });
    } else {
      setStaffRoleLabel('Gerente Operacional do Catálogo');
      setStaffPerms({
        canManagePhotos: true,
        canEditProducts: true,
        canCreateOrDeleteProducts: true,
        canManageSegments: true,
        canEditPrices: true,
        canManageSellers: true,
        canDeleteLeads: true,
        canChangeLogo: true,
      });
    }
  };

  const handleSelectRole = (nextRole: StaffRole) => {
    setStaffRole(nextRole);
    if (nextRole === 'seller') {
      const firstSeller = sellers[0];
      if (firstSeller) {
        setStaffSellerId(firstSeller.id);
        if (!staffName.trim()) {
          setStaffName(firstSeller.name);
        }
        setStaffRoleLabel(firstSeller.roleTitle || 'Consultor Comercial');
      } else {
        setStaffSellerId('');
        setStaffRoleLabel('Consultor Comercial');
      }
    } else {
      setStaffSellerId('');
      setStaffRoleLabel('Auxiliar de Catálogo & Fotos');
    }
  };

  const handleSellerSelectChange = (selectedId: string) => {
    setStaffSellerId(selectedId);
    const found = sellers.find((s) => s.id === selectedId);
    if (found) {
      setStaffName(found.name);
      setStaffRoleLabel(found.roleTitle || 'Consultor Comercial');
    }
  };

  const handleSubmitStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);
    setStaffFormSuccess(null);

    const cleanEmail = staffEmail.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;

    if (!emailRegex.test(cleanEmail) || cleanEmail.length < 5 || cleanEmail.length > 128) {
      setStaffFormError('Informe um endereço de e-mail válido.');
      return;
    }

    if (cleanEmail === adminEmail.trim().toLowerCase()) {
      setStaffFormError(
        'Este e-mail já é o Administrador Geral proprietário do sistema.'
      );
      return;
    }

    const resolvedSeller =
      staffRole === 'seller' ? sellers.find((s) => s.id === staffSellerId) : null;

    if (staffRole === 'seller' && !resolvedSeller) {
      setStaffFormError(
        'Selecione a qual vendedor cadastrado este e-mail será vinculado (ou cadastre o vendedor primeiro na aba Vendedores).'
      );
      return;
    }

    const cleanName = (staffName.trim() || resolvedSeller?.name || '').trim();
    const cleanRoleLabel = (
      staffRoleLabel.trim() ||
      resolvedSeller?.roleTitle ||
      (staffRole === 'seller' ? 'Consultor Comercial' : 'Auxiliar de Catálogo')
    ).trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      setStaffFormError('Informe o nome do membro da equipe (entre 2 e 80 caracteres).');
      return;
    }

    setStaffSaving(true);
    try {
      await onSaveStaffMember({
        email: cleanEmail,
        name: cleanName,
        roleLabel: cleanRoleLabel,
        role: staffRole,
        sellerId: staffRole === 'seller' && resolvedSeller ? resolvedSeller.id : '',
        ...staffPerms,
      });
      setStaffFormSuccess(
        `Acesso liberado para "${cleanName}" (${cleanEmail})! No primeiro acesso, a pessoa clica em "Primeiro acesso" na tela de login e cria a própria senha.`
      );
      setStaffEmail('');
      setStaffName('');
    } catch (err) {
      setStaffFormError(
        err instanceof Error ? err.message : 'Erro ao salvar membro da equipe.'
      );
    } finally {
      setStaffSaving(false);
    }
  };

  const copyStaffAccessInstructions = (member: StaffMember) => {
    const enabledTasks = STAFF_PERMISSION_META.filter((m) => member[m.key])
      .map((m) => `• ${m.shortLabel}`)
      .join('\n');
    const roleDesc =
      member.role === 'seller' ? 'Vendedor Autorizado' : 'Colaborador / Equipe';

    const text = [
      `Olá ${member.name}! Seu acesso ao Catálogo Campos Equipamentos foi liberado:`,
      ``,
      `🔗 Link do Painel: ${appPublicUrl}`,
      `📧 E-mail autorizado: ${member.id}`,
      `👤 Perfil: ${roleDesc} (${member.roleLabel})`,
      ``,
      `Como entrar: abra o link acima, clique em "Primeiro acesso", informe o e-mail ${member.id} e crie sua senha. Depois confirme pelo link que chegará no seu e-mail. Nas próximas vezes, é só entrar com e-mail e senha.`,
      ``,
      `Suas permissões liberadas:`,
      enabledTasks || '• Consulta ao Catálogo, Links Exclusivos e Acompanhamento de Leads',
    ].join('\n');

    navigator.clipboard?.writeText(text);
    setCopiedStaffId(member.id);
    setTimeout(() => setCopiedStaffId(null), 2500);
  };

  type PermissionToggleKey = keyof Omit<
    WorkspacePermissions,
    'id' | 'ownerId' | 'updatedAt'
  >;

  const clientControls: {
    key: PermissionToggleKey;
    title: string;
    description: string;
  }[] = [
    {
      key: 'clientShowPrices',
      title: 'Exibir Preços da Tabela PB-10X para os Clientes',
      description:
        'Se desativado, o catálogo do cliente oculta os valores em R$ e exibe "Preço sob consulta com o vendedor".',
    },
    {
      key: 'clientShowProductCode',
      title: 'Exibir Código Interno do Produto (Ex: Cód: 181498)',
      description:
        'Permite ao cliente visualizar o código interno de cadastro do equipamento nos cards e na ficha técnica.',
    },
    {
      key: 'clientShowManufacturerRef',
      title: 'Exibir Referência do Fabricante (Ex: Ref. Fab: CL390)',
      description:
        'Se desativado, oculta o modelo/referência de fábrica para evitar que o cliente pesquise o código em concorrentes.',
    },
    {
      key: 'clientShowDimensionsAndMaterial',
      title: 'Exibir Especificações Técnicas, Dimensões e Fabricante',
      description:
        'Controla se o cliente vê detalhes de construção, medidas e marca nas listagens e fichas.',
    },
    {
      key: 'clientShowPhotosCount',
      title: 'Exibir Contador de Fotos nos Cards',
      description:
        'Exibe a indicação da quantidade de fotos disponíveis na galeria de cada equipamento.',
    },
    {
      key: 'clientHideOutOfStock',
      title: 'Ocultar Automaticamente Produtos "Sob Encomenda / Sem Estoque"',
      description:
        'Quando ativado, clientes que abrem o link veem apenas equipamentos marcados como "Em Estoque".',
    },
    {
      key: 'clientShowWhatsappButton',
      title: 'Exibir Botões Diretos de WhatsApp do Vendedor',
      description:
        'Permite ao cliente clicar para chamar diretamente o vendedor responsável no WhatsApp.',
    },
    {
      key: 'clientRequireIdentification',
      title: 'Tornar Nome e Telefone Obrigatórios antes de Abrir o Catálogo',
      description:
        'Se desativado (padrão), o cliente vê a tela inicial pedindo nome e telefone, mas pode pular caso não queira preencher.',
    },
  ];

  const sellerControls: {
    key: PermissionToggleKey;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'sellerCanEditProducts',
      title: 'Permitir por Padrão que Vendedores Editem o Cadastro dos Produtos',
      description:
        'Define o padrão geral para liberar o botão "Editar Cadastro" para vendedores.',
      icon: <Pencil className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanEditPrices',
      title: 'Permitir por Padrão que Vendedores Alterem Preços (Tabela PB-10X)',
      description:
        'Define se o campo de Preço (R$) fica liberado por padrão para vendedores.',
      icon: <Tag className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanManagePhotos',
      title: 'Permitir por Padrão que Vendedores Incluam ou Troquem Fotos dos Produtos',
      description:
        'Define se vendedores podem incluir ou trocar fotos por padrão.',
      icon: <Camera className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanManageSegments',
      title: 'Permitir que Vendedores Criem/Editem Segmentos e Marquem Produtos',
      description:
        'Autoriza vendedores a criar novos segmentos de catálogo e marcar a qual segmento cada produto pertence.',
      icon: <Tag className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanCreateOrDeleteProducts',
      title: 'Permitir Cadastrar Novos Produtos ou Excluir Equipamentos',
      description:
        'Autoriza vendedores a adicionar novos itens ao banco de dados, restaurar itens do PDF ou excluir produtos.',
      icon: <Trash2 className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanManageSellers',
      title: 'Permitir Cadastrar, Inativar ou Excluir Vendedores',
      description:
        'Se desativado, vendedores podem apenas copiar seus links e enviar no WhatsApp, sem alterar a equipe.',
      icon: <Users className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanDeleteLeads',
      title: 'Permitir que Vendedores Excluam Leads Capturados',
      description:
        'Se desativado, vendedores podem atualizar o estágio do atendimento dos leads, mas não podem apagar registros do CRM.',
      icon: <Trash2 className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanViewPdfTable',
      title: 'Permitir que Vendedores Abram/Baixem a Tabela PDF Completa',
      description:
        'Controla a exibição do botão "Abrir PDF Original" no painel interno.',
      icon: <FileText className="w-4 h-4 text-slate-700" />,
    },
    {
      key: 'sellerCanChangeLogo',
      title: 'Permitir que Vendedores Alterem a Logomarca da Empresa',
      description:
        'Se desativado, somente o Administrador ou membro autorizado pode trocar a logomarca exibida no topo.',
      icon: <Upload className="w-4 h-4 text-slate-700" />,
    },
  ];

  const sellerStaffMembers = staffMembers.filter((m) => m.role === 'seller');
  const collaboratorStaffMembers = staffMembers.filter((m) => m.role === 'collaborator');

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 mb-8 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium mb-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Painel Administrativo · Acesso por e-mail e senha</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-sans">
            Permissões & Equipe (/staff)
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Cadastre os membros da equipe (vendedores e colaboradores) pelo e-mail, defina suas permissões individuais e configure a visualização externa dos clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-600">
            Administrador: <strong className="text-slate-900 font-mono-tabular">{adminEmail}</strong>
          </div>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="px-3.5 py-2 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 hover:text-red-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {(permSaveMessage || permSaveError) && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
            permSaveError
              ? 'bg-red-50/80 border-red-200 text-red-800'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{permSaveError || permSaveMessage}</span>
          </div>
          <span className="text-[11px] opacity-75 hidden sm:inline">
            Salvo no Firestore
          </span>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: CADASTRAR E GERENCIAR MEMBROS DA EQUIPE POR E-MAIL GOOGLE (/staff/{email})
         ===================================================================== */}
      <section className="mb-8 bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100">
          <div>
            <div className="text-xs font-medium text-red-700 mb-1">
              Controle de Acesso · Equipe autorizada
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              Membros da Equipe Autorizados ({staffMembers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Autorize vendedores e colaboradores pelo <strong>e-mail</strong> (pode ser o e-mail da empresa). No primeiro acesso cada pessoa cria a própria senha; ao entrar, o sistema identifica automaticamente o papel e aplica as permissões marcadas abaixo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-slate-400 mr-1">
              Perfil rápido:
            </span>
            <button
              type="button"
              onClick={() => applyStaffPreset('somente_vendas')}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Apenas Vendas
            </button>
            <button
              type="button"
              onClick={() => applyStaffPreset('fotos_desc')}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Fotos + Descrições
            </button>
            <button
              type="button"
              onClick={() => applyStaffPreset('catalogo_completo')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Catálogo Completo
            </button>
            <button
              type="button"
              onClick={() => applyStaffPreset('gerente_total')}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Liberar Tudo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 5 cols: Register Team Member by Email */}
          <form onSubmit={handleSubmitStaffMember} className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Autorizar E-mail da Equipe
              </div>

              {/* Choose Role: Seller vs Collaborator */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Papel na Equipe (Role)
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSelectRole('seller')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      staffRole === 'seller'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vendedor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('collaborator')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      staffRole === 'collaborator'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Colaborador
                  </button>
                </div>
              </div>

              {/* If role === 'seller', select which existing Seller this email is linked to */}
              {staffRole === 'seller' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Vincular ao Vendedor Cadastrado
                  </label>
                  {sellers.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                      Nenhum vendedor cadastrado ainda. Cadastre o vendedor na aba <strong>Vendedores</strong> primeiro ou mude o papel acima para Colaborador.
                    </div>
                  ) : (
                    <select
                      value={staffSellerId}
                      onChange={(e) => handleSellerSelectChange(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    >
                      <option value="">Selecione um vendedor...</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.whatsapp})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  E-mail do Membro
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="Ex: vendedor@gmail.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-tabular focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Marcos Oliveira"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                   Cargo / Função (roleLabel)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Consultor Comercial / Auxiliar de Catálogo"
                  value={staffRoleLabel}
                  onChange={(e) => setStaffRoleLabel(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              {staffFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-semibold">
                  {staffFormError}
                </div>
              )}

              {staffFormSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-semibold">
                  {staffFormSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={staffSaving || (staffRole === 'seller' && sellers.length === 0)}
                className="w-full py-3 px-4 bg-red-700 text-white text-xs font-semibold rounded-xl hover:bg-red-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {staffSaving
                    ? 'Salvando em /staff...'
                    : 'Autorizar E-mail na Equipe'}
                </span>
              </button>
            </div>
          </form>

          {/* Right 7 cols: Task Checkboxes for New Staff Member */}
          <div className="lg:col-span-7">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              2. Marque as Permissões deste Membro da Equipe
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STAFF_PERMISSION_META.map((perm) => {
                const checked = staffPerms[perm.key];
                return (
                  <label
                    key={perm.key}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-600 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setStaffPerms((prev) => ({
                          ...prev,
                          [perm.key]: !prev[perm.key],
                        }))
                      }
                      className="w-4 h-4 mt-0.5 accent-emerald-700 rounded cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900">{perm.shortLabel}</div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {perm.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* List of Registered Staff Members (/staff/{email}) */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Equipe Cadastrada em /staff ({staffMembers.length} — {sellerStaffMembers.length}{' '}
                {sellerStaffMembers.length === 1 ? 'vendedor' : 'vendedores'} e{' '}
                {collaboratorStaffMembers.length}{' '}
                {collaboratorStaffMembers.length === 1 ? 'colaborador' : 'colaboradores'})
              </h3>
              <p className="text-xs text-slate-500">
                Clique nos botões de cada permissão abaixo para liberar ou bloquear funções em tempo real.
              </p>
            </div>
          </div>

          {staffMembers.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500">
              Nenhum membro cadastrado em <code>/staff</code> ainda. Utilize o formulário acima para autorizar o e-mail dos seus vendedores e colaboradores.
            </div>
          ) : (
            <div className="space-y-4">
              {staffMembers.map((member) => {
                const isCopied = copiedStaffId === member.id;
                const linkedSeller =
                  member.role === 'seller'
                    ? sellers.find((s) => s.id === member.sellerId)
                    : null;

                return (
                  <div
                    key={member.id}
                    className={`border rounded-2xl p-5 transition-colors ${
                      member.active
                        ? 'bg-white border-slate-200/80'
                        : 'bg-slate-50/60 border-slate-200/60 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {member.name}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-xs font-semibold text-red-700">
                              {member.role === 'seller' ? 'Vendedor' : 'Colaborador'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-xs text-slate-500">{member.roleLabel}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={`text-xs font-medium ${
                                member.active ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {member.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                            <span>
                              E-mail:{' '}
                              <strong className="font-mono-tabular text-slate-800">
                                {member.id}
                              </strong>
                            </span>
                            {member.role === 'seller' && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span>
                                  Vendedor vinculado:{' '}
                                  <strong className="text-slate-800">
                                    {linkedSeller ? linkedSeller.name : member.sellerId || '—'}
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSetStaffPermissionPreset(member, 'somente_vendas')
                          }
                          className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Só Vendas
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStaffPermissionPreset(member, 'fotos_desc')}
                          className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Fotos + Descrição
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onSetStaffPermissionPreset(member, 'catalogo_completo')
                          }
                          className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Catálogo Completo
                        </button>

                        <button
                          type="button"
                          onClick={() => copyStaffAccessInstructions(member)}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Convite</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleStaffActive(member)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {member.active ? 'Desativar' : 'Ativar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteStaffMember(member)}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Excluir membro da equipe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Granular Task Toggles for this Staff Member */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {STAFF_PERMISSION_META.map((perm) => {
                        const enabled = Boolean(member[perm.key]);
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() => onToggleStaffPermission(member, perm.key)}
                            className={`px-3 py-2 rounded-xl text-xs border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              enabled
                                ? 'bg-emerald-50/60 border-emerald-300 text-slate-900 font-medium'
                                : 'bg-slate-50/50 border-slate-200/70 text-slate-400 hover:text-slate-700'
                            }`}
                            title={perm.title}
                          >
                            <span className="truncate">{perm.shortLabel}</span>
                            <span
                              className={`w-4.5 h-4.5 rounded flex items-center justify-center shrink-0 ${
                                enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200/70 text-slate-400'
                              }`}
                            >
                              {enabled ? <Check className="w-3 h-3" /> : <Lock className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Client Visibility Permissions & Seller Editing Permissions */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 2: O QUE OS CLIENTES PODEM VER */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Visão Externa · Links Enviados aos Clientes</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-sans">
                  1. O que os Clientes Podem Ver no Catálogo
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  As alterações abaixo entram em vigor imediatamente em todos os links de catálogo
                  abertos por clientes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    savePermissionsDocument(
                      {
                        clientShowPrices: true,
                        clientShowProductCode: true,
                        clientShowManufacturerRef: true,
                        clientShowDimensionsAndMaterial: true,
                        clientShowPhotosCount: true,
                        clientShowWhatsappButton: true,
                      },
                      'Modo Catálogo Completo (com preços e códigos) ativado para os clientes!'
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Mostrar Tudo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    savePermissionsDocument(
                      {
                        clientShowPrices: false,
                        clientShowManufacturerRef: false,
                      },
                      'Modo "Preço Sob Consulta e Sem Ref. Fabricante" ativado para os clientes!'
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Ocultar Preços & Ref. Fab.
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {clientControls.map((item) => {
                const isEnabled = Boolean(permissions[item.key]);
                return (
                  <div
                    key={item.key}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{item.title}</div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => handleTogglePermissionKey(item.key)}
                      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: PERMISSÕES GERAIS / PADRÃO PARA VENDEDORES */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Painel Interno · Regras Gerais & Padrão para Vendedores</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-sans">
                  2. Permissões Padrão em Lote para Vendedores
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina o padrão geral ou altere em lote para todos os vendedores da equipe.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    savePermissionsDocument(
                      {
                        sellerCanEditProducts: false,
                        sellerCanEditPrices: false,
                        sellerCanCreateOrDeleteProducts: false,
                        sellerCanManagePhotos: false,
                        sellerCanManageSegments: false,
                        sellerCanManageSellers: false,
                        sellerCanDeleteLeads: false,
                        sellerCanChangeLogo: false,
                      },
                      'Edição bloqueada por padrão para vendedores!'
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Bloquear Edição p/ Todos Vendedores
                </button>
                <button
                  type="button"
                  onClick={() =>
                    savePermissionsDocument(
                      {
                        sellerCanManagePhotos: true,
                        sellerCanEditProducts: true,
                      },
                      'Edição de fotos e descrição liberada por padrão!'
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Liberar Fotos & Descrição p/ Todos
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {sellerControls.map((item) => {
                const isEnabled = Boolean(permissions[item.key]);
                return (
                  <div
                    key={item.key}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{item.title}</div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => handleTogglePermissionKey(item.key)}
                      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 4 Cols: Authentication Info */}
        <div className="lg:col-span-4 space-y-6 sticky top-24">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Segurança do Acesso</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              Acesso com E-mail e Senha
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Só entra quem o Administrador cadastrou e que confirmou o próprio e-mail. Cada pessoa tem sua senha individual, guardada de forma criptografada pelo Supabase Auth. Quem esquecer a senha usa "Esqueci minha senha" na tela de login.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="text-slate-500">Conta de Administrador Geral:</div>
              <div className="font-mono-tabular font-bold text-slate-900 break-all">
                {adminEmail}
              </div>
            </div>
          </section>

          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-red-700" />
              <span>Como funciona o acesso da equipe</span>
            </div>
            <p className="leading-relaxed">
              • <strong>Administrador Geral</strong>: Entra com o e-mail proprietário e possui controle total do catálogo, preços e equipe.
            </p>
            <p className="leading-relaxed">
              • <strong>Vendedor (`role: seller`)</strong>: Entra com seu e-mail cadastrado na equipe, vinculado ao seu perfil de vendedor.
            </p>
            <p className="leading-relaxed">
              • <strong>Colaborador (`role: collaborator`)</strong>: Entra com seu e-mail cadastrado na equipe e utiliza apenas as ferramentas liberadas pelo Administrador.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

interface AdminLoginModalProps {
  show: boolean;
  onClose: () => void;
  companyLogoUrl?: string;
  adminLoginError: string | null;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  show,
  onClose,
  companyLogoUrl = DEFAULT_COMPANY_LOGO,
  adminLoginError,
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 lg:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
          <img
            src={companyLogoUrl || DEFAULT_COMPANY_LOGO}
            alt="Logomarca da Empresa"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO;
            }}
            className="max-h-11 w-auto object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mb-5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Acesso da Equipe</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">
            Entrar no Painel Interno
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Entre com o e-mail cadastrado pelo Administrador e sua senha.
          </p>
        </div>

        <EmailLoginForm externalError={adminLoginError} />
      </div>
    </div>
  );
};
