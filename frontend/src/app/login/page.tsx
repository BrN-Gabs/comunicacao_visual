"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordVisibilityButton } from "@/components/forms/password-visibility-button";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { login, requestPasswordRecovery } from "@/services/auth.service";
import styles from "./page.module.css";

type AuthTab = "login" | "recover";

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16v12H4z" />
      <path d="m5 7 7 6 7-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8" />
      <path d="m15.6 15.6 2.8 2.8" />
      <path d="m15.6 8.4 2.8-2.8" />
      <path d="m5.6 18.4 2.8-2.8" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginPage() {
  const router = useRouter();
  const { startRouteTransition } = useRouteTransition();

  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState("");

  function handleTabChange(nextTab: AuthTab) {
    setActiveTab(nextTab);
    setError("");
    setRecoveryError("");
    setRecoverySuccess("");

    if (nextTab === "recover" && !recoveryEmail && email.trim()) {
      setRecoveryEmail(email.trim().toLowerCase());
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setRecoveryError("");
    setRecoverySuccess("");

    const startedAt = Date.now();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError("Informe um e-mail válido para continuar.");
      setLoading(false);
      return;
    }

    try {
      const response = await login({ email: normalizedEmail, password });

      localStorage.setItem("token", response.accessToken);
      localStorage.setItem("user", JSON.stringify(response.user));

      const elapsed = Date.now() - startedAt;
      const remainingLoading = Math.max(1400 - elapsed, 0);

      if (remainingLoading > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, remainingLoading);
        });
      }

      startRouteTransition({
        label: "Entrando no painel",
        minDuration: 1100,
      });
      router.push("/dashboard");

      return;
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Erro ao fazer login"));
    }

    setLoading(false);
  }

  async function handleRecoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRecovering(true);
    setRecoveryError("");
    setRecoverySuccess("");

    const normalizedEmail = recoveryEmail.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setRecoveryError("Informe um e-mail válido para continuar.");
      setIsRecovering(false);
      return;
    }

    try {
      const response = await requestPasswordRecovery({
        email: normalizedEmail,
      });

      setRecoverySuccess(
        response.message ||
          "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
      );
      setRecoveryEmail(normalizedEmail);
    } catch (err: unknown) {
      setRecoveryError(
        getApiErrorMessage(err, "Não foi possível registrar a recuperação de senha."),
      );
    }

    setIsRecovering(false);
  }

  return (
    <main className={styles.loginPage}>
      <div className={styles.backdropGlow} />
      <div className={styles.backdropGrid} />

      <section className={styles.loginShell}>
        <div className={styles.brandPanel}>
          <div className={styles.brandBadge}>
            <span className={styles.brandBadgeIcon}>
              <SparkIcon />
            </span>
            <span>Gazin Comunicações Visuais</span>
          </div>

          <div className={styles.brandContent}>
            <p className={styles.eyebrow}>Acesso operacional</p>
            <h1>Entre na central que organiza toda a comunicação visual.</h1>
            <p className={styles.brandDescription}>
              Um ambiente único para acompanhar produções, validar materiais e
              manter o fluxo das lojas com mais clareza.
            </p>
          </div>

          <div className={styles.brandHighlights}>
            <article className={styles.highlightCard}>
              <strong>Fluxo mais claro</strong>
              <span>
                Acompanhe status, responsáveis e entregas em um só lugar.
              </span>
            </article>
            <article className={styles.highlightCard}>
              <strong>Operação mais rápida</strong>
              <span>
                Pesquise comunicações visuais e retome atividades sem atrito.
              </span>
            </article>
            <article className={styles.highlightCard}>
              <strong>Controle por perfil</strong>
              <span>
                Admin, VIP e Normal com acesso alinhado ao papel de cada um.
              </span>
            </article>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.authTabs} role="tablist" aria-label="Acesso">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              className={`${styles.authTabButton} ${
                activeTab === "login" ? styles.authTabButtonActive : ""
              }`}
              onClick={() => handleTabChange("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "recover"}
              className={`${styles.authTabButton} ${
                activeTab === "recover" ? styles.authTabButtonActive : ""
              }`}
              onClick={() => handleTabChange("recover")}
            >
              Recuperar senha
            </button>
          </div>

          <div className={styles.formHeader}>
            <p className={styles.formTag}>
              {activeTab === "login" ? "Login seguro" : "Recuperação de acesso"}
            </p>
            <h2>
              {activeTab === "login"
                ? "Bem-vindo de volta"
                : "Recupere sua senha"}
            </h2>
            <p>
              {activeTab === "login"
                ? "Use seu e-mail corporativo e sua senha para acessar o painel de comunicações visuais."
                : "Informe seu e-mail para receber um link seguro de redefinição de senha."}
            </p>
          </div>

          {activeTab === "login" ? (
            <form onSubmit={handleSubmit} className={styles.formCard}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>E-mail</span>
                <span className={styles.fieldControl}>
                  <span className={styles.fieldIcon}>
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@gazin.com.br"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Senha</span>
                <span
                  className={`${styles.fieldControl} ${styles.fieldControlPassword}`}
                >
                  <span className={styles.fieldIcon}>
                    <LockIcon />
                  </span>
                  <input
                    type={isPasswordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <PasswordVisibilityButton
                    visible={isPasswordVisible}
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    className={styles.fieldVisibilityButton}
                  />
                </span>
              </label>

              {error ? (
                <div className={styles.errorBox} role="alert" aria-live="polite">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={styles.submitButton}
              >
                <span className={styles.submitButtonContent}>
                  {loading ? (
                    <span className={styles.submitSpinner} aria-hidden="true" />
                  ) : null}
                  <span>{loading ? "Entrando..." : "Entrar no painel"}</span>
                </span>
              </button>

              <p className={styles.formFootnote}>
                Ambiente interno para gestão das comunicações visuais da
                operação.
              </p>
            </form>
          ) : (
            <form onSubmit={handleRecoverySubmit} className={styles.formCard}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>E-mail</span>
                <span className={styles.fieldControl}>
                  <span className={styles.fieldIcon}>
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@gazin.com.br"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <p className={styles.recoveryHint}>
                Se o e-mail estiver cadastrado, você receberá um link para
                criar uma nova senha.
              </p>

              {recoveryError ? (
                <div className={styles.errorBox} role="alert" aria-live="polite">
                  {recoveryError}
                </div>
              ) : null}

              {recoverySuccess ? (
                <div
                  className={styles.successBox}
                  role="status"
                  aria-live="polite"
                >
                  {recoverySuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isRecovering}
                className={styles.submitButton}
              >
                <span className={styles.submitButtonContent}>
                  {isRecovering ? (
                    <span className={styles.submitSpinner} aria-hidden="true" />
                  ) : null}
                  <span>
                    {isRecovering
                      ? "Registrando..."
                      : "Solicitar recuperação"}
                  </span>
                </span>
              </button>

              <p className={styles.formFootnote}>
                O link enviado por e-mail expira automaticamente para manter o
                acesso protegido.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
