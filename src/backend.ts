/**
 * Camada de dados do app sobre o Supabase.
 *
 * Substitui o antigo src/firebase.ts. Expõe uma API no mesmo formato da que
 * o app já usava (doc, collection, query, where, getDoc, getDocs, setDoc,
 * updateDoc, deleteDoc, onSnapshot, serverTimestamp, auth...), mas tudo é
 * gravado em tabelas Postgres protegidas por Row Level Security
 * (veja supabase/migrations).
 *
 * Mapeamento de caminhos:
 *   settings/{id}              -> tabela settings
 *   permissions/{id}           -> tabela permissions
 *   staff/{email}              -> tabela staff
 *   sellers/{id}               -> tabela sellers
 *   segments/{id}              -> tabela segments
 *   products/{id}              -> tabela products
 *   leads/{id}                 -> tabela leads
 *   leads/{leadId}/views/{id}  -> tabela lead_views (chave leadId + id)
 */
import {
  createClient,
  type EmailOtpType,
  type RealtimeChannel,
  type Session,
  type User,
} from '@supabase/supabase-js';

// Projeto Supabase da Campos Equipamentos. A chave "publishable" é PÚBLICA por
// natureza (vai para o navegador de qualquer forma); a proteção dos dados é feita
// pelas regras de segurança (RLS) do banco. Fica aqui como padrão para o app
// funcionar no Google AI Studio, que não lê o arquivo .env.local.
// Para usar outro projeto, defina VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const DEFAULT_SUPABASE_URL = 'https://qnwrdshzxzdafajemzsl.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_S3sDaUi_sWHs3ykiKtN_xA_ifMNhdKi';

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});
const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // 'implicit' permite abrir o link de confirmação / nova senha em outro
    // aparelho (ex.: cadastro no computador, e-mail aberto no celular).
    flowType: 'implicit',
  },
});

// =========================================================================
// Timestamp (compatível com o que o app esperava do Firestore)
// =========================================================================
export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(d: Date): Timestamp {
    const ms = d.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toJSON() {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds };
  }
}

const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt']);

/** Valor especial: a data é preenchida pelo banco (trigger). */
const SERVER_TIMESTAMP = Symbol('serverTimestamp');
export function serverTimestamp(): unknown {
  return SERVER_TIMESTAMP;
}

// =========================================================================
// Referências
// =========================================================================
export const db = { kind: 'supabase-db' } as const;
type Db = typeof db;

interface TableTarget {
  table: string;
  /** Filtros fixos derivados do caminho (ex.: leadId da subcoleção views) */
  scope: Record<string, string>;
}

export interface CollectionReference {
  type: 'collection';
  path: string;
  target: TableTarget;
  filters: Array<{ field: string; value: unknown }>;
}

export type Query = CollectionReference;

export interface DocumentReference {
  type: 'document';
  id: string;
  path: string;
  target: TableTarget;
}

function resolveCollection(segments: string[]): TableTarget {
  if (segments.length === 1) {
    return { table: segments[0], scope: {} };
  }
  if (segments.length === 3 && segments[0] === 'leads' && segments[2] === 'views') {
    return { table: 'lead_views', scope: { leadId: segments[1] } };
  }
  throw new Error(`Caminho de coleção não suportado: ${segments.join('/')}`);
}

function splitPath(parts: string[]): string[] {
  return parts.flatMap((p) => String(p).split('/')).filter(Boolean);
}

export function collection(_db: Db, ...pathParts: string[]): CollectionReference {
  const segments = splitPath(pathParts);
  return { type: 'collection', path: segments.join('/'), target: resolveCollection(segments), filters: [] };
}

export function doc(_db: Db, ...pathParts: string[]): DocumentReference {
  const segments = splitPath(pathParts);
  if (segments.length % 2 !== 0) {
    throw new Error(`Caminho de documento inválido: ${segments.join('/')}`);
  }
  const id = segments[segments.length - 1];
  return {
    type: 'document',
    id,
    path: segments.join('/'),
    target: resolveCollection(segments.slice(0, -1)),
  };
}

interface WhereClause {
  field: string;
  op: '==';
  value: unknown;
}

export function where(field: string, op: '==', value: unknown): WhereClause {
  if (op !== '==') throw new Error(`Operador não suportado: ${op}`);
  return { field, op, value };
}

export function query(ref: CollectionReference, ...clauses: WhereClause[]): Query {
  return {
    ...ref,
    filters: [...ref.filters, ...clauses.map((c) => ({ field: c.field, value: c.value }))],
  };
}

// =========================================================================
// Snapshots
// =========================================================================
type Row = Record<string, unknown>;

export class DocumentSnapshot<T = Row> {
  readonly id: string;
  private readonly row: Row | null;

  constructor(id: string, row: Row | null) {
    this.id = id;
    this.row = row;
  }

  exists(): boolean {
    return this.row !== null;
  }

  data(): T {
    return (this.row ? fromRow(this.row) : undefined) as T;
  }
}

export class QuerySnapshot<T = Row> {
  readonly docs: DocumentSnapshot<T>[];

  constructor(docs: DocumentSnapshot<T>[]) {
    this.docs = docs;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(cb: (d: DocumentSnapshot<T>) => void) {
    this.docs.forEach(cb);
  }
}

function fromRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id') continue;
    if (TIMESTAMP_FIELDS.has(k) && typeof v === 'string') {
      out[k] = Timestamp.fromDate(new Date(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Remove campos de data (o banco preenche) e o id. */
function toRow(data: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id' || TIMESTAMP_FIELDS.has(k) || v === SERVER_TIMESTAMP || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function throwIfError(error: { message: string; code?: string } | null) {
  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }
}

// =========================================================================
// Leitura
// =========================================================================
export async function getDoc<T = Row>(ref: DocumentReference): Promise<DocumentSnapshot<T>> {
  let q = supabase.from(ref.target.table).select('*').eq('id', ref.id);
  for (const [k, v] of Object.entries(ref.target.scope)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  throwIfError(error);
  return new DocumentSnapshot<T>(ref.id, (data as Row | null) ?? null);
}

export async function getDocs<T = Row>(ref: Query): Promise<QuerySnapshot<T>> {
  let q = supabase.from(ref.target.table).select('*');
  for (const [k, v] of Object.entries(ref.target.scope)) q = q.eq(k, v);
  for (const f of ref.filters) q = q.eq(f.field, f.value as string);
  const { data, error } = await q;
  throwIfError(error);
  return new QuerySnapshot<T>(((data as Row[]) || []).map((r) => new DocumentSnapshot<T>(String(r.id), r)));
}

// =========================================================================
// Escrita
// =========================================================================
function conflictTarget(ref: DocumentReference): string {
  return ref.target.table === 'lead_views' ? 'leadId,id' : 'id';
}

/** Grava o documento inteiro (cria ou substitui). */
export async function setDoc(ref: DocumentReference, data: Row, options?: { merge?: boolean }): Promise<void> {
  const row = { ...toRow(data), ...ref.target.scope, id: ref.id };
  if (options?.merge) {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, data);
      return;
    }
  }
  const { error } = await supabase
    .from(ref.target.table)
    .upsert(row, { onConflict: conflictTarget(ref) });
  throwIfError(error);
}

/** Atualiza apenas os campos informados. */
export async function updateDoc(ref: DocumentReference, data: Row): Promise<void> {
  const row = toRow(data);
  if (Object.keys(row).length === 0) {
    // só updatedAt: força o trigger de data atualizar
    row.ownerId = 'campos_workspace';
  }
  let q = supabase.from(ref.target.table).update(row).eq('id', ref.id);
  for (const [k, v] of Object.entries(ref.target.scope)) q = q.eq(k, v);
  const { error } = await q;
  throwIfError(error);
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  let q = supabase.from(ref.target.table).delete().eq('id', ref.id);
  for (const [k, v] of Object.entries(ref.target.scope)) q = q.eq(k, v);
  const { error } = await q;
  throwIfError(error);
}

// =========================================================================
// Tempo real (onSnapshot)
// =========================================================================
let channelSeq = 0;

export function onSnapshot<T = Row>(
  ref: DocumentReference,
  next: (snap: DocumentSnapshot<T>) => void,
  onError?: (err: Error) => void
): () => void;
export function onSnapshot<T = Row>(
  ref: Query,
  next: (snap: QuerySnapshot<T>) => void,
  onError?: (err: Error) => void
): () => void;
export function onSnapshot(
  ref: DocumentReference | Query,
  next: (snap: never) => void,
  onError?: (err: Error) => void
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let rerun = false;

  const load = async () => {
    if (!active) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const snap = ref.type === 'document' ? await getDoc(ref) : await getDocs(ref);
      if (active) next(snap as never);
    } catch (err) {
      if (active) onError?.(err as Error);
    } finally {
      running = false;
      if (rerun && active) {
        rerun = false;
        void load();
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 150);
  };

  // Filtro do Realtime: no máximo um (o Supabase aceita um por inscrição)
  let filter: string | undefined;
  if (ref.type === 'document' && ref.target.table !== 'lead_views') {
    filter = `id=eq.${ref.id}`;
  } else if (ref.target.scope.leadId) {
    filter = `leadId=eq.${ref.target.scope.leadId}`;
  }

  const channel: RealtimeChannel = supabase
    .channel(`snap_${ref.target.table}_${++channelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: ref.target.table, ...(filter ? { filter } : {}) },
      schedule
    )
    .subscribe((status) => {
      // (Re)conectou: recarrega para não perder alterações feitas offline
      if (status === 'SUBSCRIBED') schedule();
    });

  void load();

  // Quando a sessão muda (anônimo -> Google, logout), as permissões mudam: recarrega
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') schedule();
  });

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    authSub.subscription.unsubscribe();
    void supabase.removeChannel(channel);
  };
}

// =========================================================================
// Autenticação (anônimo para visitantes, e-mail e senha para a equipe)
// =========================================================================
export interface AppUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
}

function toAppUser(user: User | null | undefined): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    isAnonymous: Boolean(user.is_anonymous),
  };
}

let currentUser: AppUser | null = null;

export const auth = {
  get currentUser(): AppUser | null {
    return currentUser;
  },
};
type Auth = typeof auth;

function applySession(session: Session | null) {
  currentUser = toAppUser(session?.user);
}

// Mantém auth.currentUser em dia (síncrono, como no Firebase)
supabase.auth.onAuthStateChange((_event, session) => applySession(session));

/**
 * Observa login/logout. O callback roda fora do listener do Supabase
 * (setTimeout) porque ele faz consultas ao banco, o que travaria o cliente.
 */
export function onAuthStateChanged(_auth: Auth, cb: (user: AppUser | null) => void): () => void {
  let lastUid: string | null | undefined = undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    applySession(session);
    const user = toAppUser(session?.user);
    const uid = user?.uid ?? null;
    if (uid === lastUid && event !== 'USER_UPDATED') return; // ignora TOKEN_REFRESHED etc.
    lastUid = uid;
    setTimeout(() => cb(user), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInAnonymously(_auth: Auth): Promise<{ user: AppUser }> {
  // Se a página abriu por um link de e-mail, espera o login desse link primeiro
  await emailLinkReady;
  if (currentUser) return { user: currentUser };
  const { data, error } = await supabase.auth.signInAnonymously();
  throwIfError(error);
  applySession(data.session);
  const user = toAppUser(data.user);
  if (!user) throw new Error('Falha no login anônimo');
  return { user };
}

// -------------------------------------------------------------------------
// Login da equipe com e-mail e senha
// -------------------------------------------------------------------------
function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

function translateAuthError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  const msg = error.message || '';
  const code = error.code || '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg))
    return 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos para sua caixa de entrada.';
  if (code === 'weak_password' || /password should be/i.test(msg))
    return 'A senha precisa ter pelo menos 8 caracteres.';
  if (code === 'user_already_exists' || /already registered/i.test(msg))
    return 'Este e-mail já tem cadastro. Use "Entrar" ou "Esqueci minha senha".';
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg))
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (code === 'same_password') return 'A nova senha precisa ser diferente da anterior.';
  return 'Não foi possível concluir. Tente novamente.';
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? { ok: false, error: translateAuthError(error) || undefined } : { ok: true };
}

/** Primeiro acesso: cria a senha e envia o e-mail de confirmação. */
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: `${appBaseUrl()}?${CONFIRM_PARAM}=1` },
  });
  if (error) return { ok: false, error: translateAuthError(error) || undefined };
  // O Supabase não dá erro quando o e-mail já tem conta (por segurança): devolve
  // um usuário sem identidades e não envia e-mail. Avisamos a pessoa.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      ok: false,
      error: 'Este e-mail já tem cadastro. Use "Entrar" ou, se não souber a senha, "Esqueci minha senha".',
    };
  }
  return { ok: true };
}

export async function resendConfirmationEmail(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${appBaseUrl()}?${CONFIRM_PARAM}=1` },
  });
  return error ? { ok: false, error: translateAuthError(error) || undefined } : { ok: true };
}

const RECOVERY_PARAM = 'nova-senha';
const CONFIRM_PARAM = 'confirmar';

export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${appBaseUrl()}?${RECOVERY_PARAM}=1`,
  });
  return error ? { ok: false, error: translateAuthError(error) || undefined } : { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  await emailLinkReady;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u || u.is_anonymous || !u.email) {
    return { ok: false, error: EXPIRED_LINK_MSG };
  }
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: translateAuthError(error) || undefined } : { ok: true };
}

// -------------------------------------------------------------------------
// Links dos e-mails (confirmar cadastro / criar nova senha)
//
// Os e-mails trazem ?token_hash=...&type=... no endereço. Diferente do antigo
// "#access_token", esses parâmetros sobrevivem a redirecionamentos (como a
// verificação de login do Google AI Studio) e funcionam em outro aparelho.
// -------------------------------------------------------------------------
let passwordRecoveryPending = false;
let passwordRecoveryError: string | null = null;
let emailLinkMessage: string | null = null;
const recoveryListeners = new Set<() => void>();

function notifyRecovery() {
  recoveryListeners.forEach((cb) => setTimeout(cb, 0));
}

const EXPIRED_LINK_MSG =
  'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha" e abra o link assim que ele chegar.';

async function handleEmailLinkInUrl(): Promise<void> {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const cameForRecovery = url.searchParams.has(RECOVERY_PARAM) || type === 'recovery';

  // Link antigo/expirado no formato #error=...
  if (hashParams.get('error_code') || hashParams.get('error')) {
    if (cameForRecovery) {
      passwordRecoveryPending = true;
      passwordRecoveryError = EXPIRED_LINK_MSG;
    } else {
      emailLinkMessage = 'Este link expirou ou já foi usado. Tente entrar ou peça um novo link.';
    }
  }

  if (tokenHash && type) {
    // Troca a sessão atual (ex.: visitante anônimo) pela da pessoa do link
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user?.is_anonymous) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (type === 'recovery') {
      passwordRecoveryPending = true;
      passwordRecoveryError = error ? EXPIRED_LINK_MSG : null;
    } else if (error) {
      emailLinkMessage = 'Este link de confirmação expirou ou já foi usado. Tente entrar com e-mail e senha.';
    } else {
      emailLinkMessage = 'E-mail confirmado! Seu acesso está ativo.';
    }
  } else if (url.searchParams.has(RECOVERY_PARAM) && !passwordRecoveryPending) {
    // Voltou do "Esqueci minha senha" sem código válido no endereço
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    passwordRecoveryPending = true;
    passwordRecoveryError = u && !u.is_anonymous && u.email ? null : EXPIRED_LINK_MSG;
  }

  // Limpa o endereço
  let changed = false;
  for (const k of ['token_hash', 'type', CONFIRM_PARAM]) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  if (url.hash && (hashParams.get('error') || hashParams.get('error_code'))) {
    url.hash = '';
    changed = true;
  }
  if (changed) window.history.replaceState(null, '', url.toString());
  if (passwordRecoveryPending) notifyRecovery();
}

/** Resolve quando o link do e-mail (se houver) já foi processado. */
export const emailLinkReady: Promise<void> = handleEmailLinkInUrl().catch(() => undefined);

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    passwordRecoveryPending = true;
    passwordRecoveryError = null;
    notifyRecovery();
  }
});

/** Mensagem a mostrar depois de abrir um link de confirmação (ou null). */
export function takeEmailLinkMessage(): string | null {
  const m = emailLinkMessage;
  emailLinkMessage = null;
  return m;
}

export function getPasswordRecoveryError(): string | null {
  return passwordRecoveryError;
}

export function isPasswordRecoveryPending(): boolean {
  return passwordRecoveryPending;
}

export function onPasswordRecovery(cb: () => void): () => void {
  recoveryListeners.add(cb);
  return () => recoveryListeners.delete(cb);
}

export function finishPasswordRecovery(): void {
  passwordRecoveryPending = false;
  passwordRecoveryError = null;
  const url = new URL(window.location.href);
  if (url.searchParams.has(RECOVERY_PARAM)) {
    url.searchParams.delete(RECOVERY_PARAM);
    window.history.replaceState(null, '', url.toString());
  }
}

export async function signOut(_auth: Auth): Promise<void> {
  const { error } = await supabase.auth.signOut();
  applySession(null);
  throwIfError(error);
}

// =========================================================================
// Tratamento de erros
// =========================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function isQuotaExceededError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string })?.code || '';
  return code === '429' || code === 'over_request_rate_limit' || /rate limit|too many requests/i.test(msg);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  if (isQuotaExceededError(error)) {
    console.warn(
      `[Supabase] Limite de requisições atingido em "${path || operationType}". Utilizando dados em cache local.`
    );
    return;
  }
  console.warn(
    'Supabase Notice:',
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string })?.code,
      operationType,
      path,
      authInfo: {
        userId: currentUser?.uid,
        email: currentUser?.email,
        isAnonymous: currentUser?.isAnonymous,
      },
    })
  );
}
