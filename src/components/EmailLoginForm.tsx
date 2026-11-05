import React, { useEffect, useState } from 'react';
import { Shield, Mail, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
  resendConfirmationEmail,
  updatePassword,
  isPasswordRecoveryPending,
  onPasswordRecovery,
  finishPasswordRecovery,
  getPasswordRecoveryError,
  emailLinkReady,
  takeEmailLinkMessage,
} from '../backend';

type Mode = 'entrar' | 'primeiro-acesso' | 'esqueci';

interface EmailLoginFormProps {
  /** Erro vindo do app (ex.: e-mail não autorizado na equipe) */
  externalError?: string | null;
}

const MIN_PASSWORD = 8;

const inputClass =
  'w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600';
const primaryBtn =
  'w-full py-3 px-4 bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-xs font-semibold ' +
  'rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs';
const linkBtn = 'text-red-700 font-semibold hover:underline cursor-pointer';

function markLoginAttempt() {
  // Faz o app mostrar o aviso caso o e-mail não esteja autorizado na equipe
  try {
    sessionStorage.setItem('campos_login_attempt', '1');
    sessionStorage.setItem('campos_is_client_mode', '0');
    localStorage.setItem('campos_is_client_mode', '0');
  } catch {
    // ignore storage errors
  }
}

/**
 * Login da equipe com e-mail e senha (Supabase Auth).
 * - Entrar: e-mail + senha
 * - Primeiro acesso: cria a senha e confirma pelo e-mail
 * - Esqueci minha senha: envia link para criar uma nova
 */
export const EmailLoginForm: React.FC<EmailLoginFormProps> = ({ externalError }) => {
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setNeedsConfirmation(false);
    setPassword('');
    setPassword2('');
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNeedsConfirmation(false);
    if (!validEmail) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (mode === 'esqueci') {
      setBusy(true);
      const r = await sendPasswordResetEmail(email);
      setBusy(false);
      if (r.ok) {
        setInfo(
          'Se este e-mail tiver cadastro, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.'
        );
      } else {
        setError(r.error || 'Não foi possível enviar o e-mail.');
      }
      return;
    }

    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    if (mode === 'primeiro-acesso') {
      if (password !== password2) {
        setError('As duas senhas não são iguais.');
        return;
      }
      setBusy(true);
      markLoginAttempt();
      const r = await signUpWithEmail(email, password);
      setBusy(false);
      if (r.ok) {
        setInfo(
          'Pronto! Enviamos um link de confirmação para o seu e-mail. Abra o link para ativar o acesso (confira também o spam).'
        );
        setPassword('');
        setPassword2('');
      } else {
        setError(r.error || 'Não foi possível criar o acesso.');
      }
      return;
    }

    setBusy(true);
    markLoginAttempt();
    const r = await signInWithEmail(email, password);
    setBusy(false);
    if (!r.ok) {
      setError(r.error || 'Não foi possível entrar.');
      setNeedsConfirmation(Boolean(r.error && r.error.includes('não foi confirmado')));
    }
  };

  const handleResend = async () => {
    setBusy(true);
    const r = await resendConfirmationEmail(email);
    setBusy(false);
    if (r.ok) {
      setError(null);
      setNeedsConfirmation(false);
      setInfo('Enviamos um novo link de confirmação. Confira a caixa de entrada e o spam.');
    } else {
      setError(r.error || 'Não foi possível reenviar.');
    }
  };

  const shownError = error || (mode === 'entrar' ? externalError : null);

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {mode !== 'entrar' && (
        <button
          type="button"
          onClick={() => switchMode('entrar')}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
        </button>
      )}

      {mode === 'primeiro-acesso' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Use o e-mail que o administrador cadastrou para você e escolha uma senha. Depois, confirme pelo
          link que chegará no seu e-mail.
        </p>
      )}
      {mode === 'esqueci' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Informe seu e-mail. Vamos enviar um link para você criar uma nova senha.
        </p>
      )}

      {shownError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold text-center">
          {shownError}
          {needsConfirmation && (
            <div className="mt-2">
              <button type="button" onClick={handleResend} disabled={busy} className={linkBtn}>
                Reenviar link de confirmação
              </button>
            </div>
          )}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold text-center">
          {info}
        </div>
      )}

      <label className="block">
        <span className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail</span>
        <span className="relative block">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className={inputClass}
            required
          />
        </span>
      </label>

      {mode !== 'esqueci' && (
        <label className="block">
          <span className="block text-[11px] font-semibold text-slate-700 mb-1">
            {mode === 'primeiro-acesso' ? 'Crie uma senha' : 'Senha'}
          </span>
          <span className="relative block">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete={mode === 'primeiro-acesso' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'primeiro-acesso' ? `Mínimo de ${MIN_PASSWORD} caracteres` : ''}
              className={inputClass}
              required
            />
          </span>
        </label>
      )}

      {mode === 'primeiro-acesso' && (
        <label className="block">
          <span className="block text-[11px] font-semibold text-slate-700 mb-1">Repita a senha</span>
          <span className="relative block">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={inputClass}
              required
            />
          </span>
        </label>
      )}

      <button type="submit" disabled={busy} className={primaryBtn}>
        <Shield className="w-4 h-4" />
        <span>
          {busy
            ? 'Aguarde...'
            : mode === 'entrar'
              ? 'Entrar'
              : mode === 'primeiro-acesso'
                ? 'Criar meu acesso'
                : 'Enviar link'}
        </span>
      </button>

      {mode === 'entrar' && (
        <div className="flex items-center justify-between text-[11px] pt-1">
          <button type="button" onClick={() => switchMode('primeiro-acesso')} className={linkBtn}>
            Primeiro acesso
          </button>
          <button type="button" onClick={() => switchMode('esqueci')} className={linkBtn}>
            Esqueci minha senha
          </button>
        </div>
      )}
    </form>
  );
};

/**
 * Tela que aparece quando a pessoa volta do link "Esqueci minha senha".
 * Fica montada no topo do app.
 */
export const PasswordRecoveryOverlay: React.FC = () => {
  const [open, setOpen] = useState<boolean>(() => isPasswordRecoveryPending());
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(() => getPasswordRecoveryError());
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(
    () =>
      onPasswordRecovery(() => {
        setLinkError(getPasswordRecoveryError());
        setOpen(true);
      }),
    []
  );

  // Aviso depois de abrir o link de confirmação de cadastro
  useEffect(() => {
    let alive = true;
    emailLinkReady.then(() => {
      const m = takeEmailLinkMessage();
      if (alive && m) setNotice(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!open) {
    if (!notice) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] max-w-md w-[calc(100%-2rem)] p-3.5 rounded-xl bg-white border border-slate-200 shadow-xl text-xs text-slate-800 font-semibold flex items-start gap-3">
        <span className="flex-1">{notice}</span>
        <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
          ✕
        </button>
      </div>
    );
  }

  const close = () => {
    finishPasswordRecovery();
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== password2) {
      setError('As duas senhas não são iguais.');
      return;
    }
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      finishPasswordRecovery();
    } else {
      setError(
        r.error ||
          'Não foi possível salvar. O link pode ter expirado: peça um novo em "Esqueci minha senha".'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 lg:p-8 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Nova senha</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">
            {done ? 'Senha alterada!' : linkError ? 'Link inválido' : 'Crie sua nova senha'}
          </h2>
        </div>

        {linkError && !done ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold text-center">
              {linkError}
            </div>
            <button type="button" onClick={close} className={primaryBtn}>
              Entendi
            </button>
          </div>
        ) : done ? (
          <button type="button" onClick={() => setOpen(false)} className={primaryBtn}>
            Continuar
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold text-center">
                {error}
              </div>
            )}
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Nova senha</span>
              <span className="relative block">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
                  className={inputClass}
                />
              </span>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-700 mb-1">Repita a nova senha</span>
              <span className="relative block">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputClass}
                />
              </span>
            </label>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <button
              type="button"
              onClick={close}
              className="w-full text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
