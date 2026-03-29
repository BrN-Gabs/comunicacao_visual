"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordVisibilityButton } from "@/components/forms/password-visibility-button";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  resetPassword,
  validatePasswordResetToken,
} from "@/services/auth.service";
import styles from "./page.module.css";

type PasswordStrength = "neutral" | "weak" | "medium" | "strong";

const specialCharacterRegex = /[^A-Za-z0-9\s]/;

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

function ShieldIcon() {
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
      <path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.8-4.2" />
    </svg>
  );
}

function isValidPassword(value: string) {
  return value.length >= 6 && specialCharacterRegex.test(value);
}

function getPasswordFeedback(passwordValue: string) {
  const password = passwordValue.trim();
  const hasMinLength = password.length >= 6;
  const hasSpecialCharacter = specialCharacterRegex.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isValid = hasMinLength && hasSpecialCharacter;

  if (!password) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Aguardando",
      level: 0 as const,
      strength: "neutral" as PasswordStrength,
    };
  }

  if (!isValid) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Fraca",
      level: 1 as const,
      strength: "weak" as PasswordStrength,
    };
  }

  const strongSignals =
    Number(hasLowercase) +
    Number(hasUppercase) +
    Number(hasNumber) +
    Number(password.length >= 8);

  if (strongSignals >= 4) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Forte",
      level: 3 as const,
      strength: "strong" as PasswordStrength,
    };
  }

  return {
    hasMinLength,
    hasSpecialCharacter,
    isValid,
    label: "Media",
    level: 2 as const,
    strength: "medium" as PasswordStrength,
  };
}

function getStrengthLabelClass(strength: PasswordStrength) {
  if (strength === "weak") {
    return styles.passwordStrengthLabelWeak;
  }

  if (strength === "medium") {
    return styles.passwordStrengthLabelMedium;
  }

  if (strength === "strong") {
    return styles.passwordStrengthLabelStrong;
  }

  return styles.passwordStrengthLabelNeutral;
}

function getStrengthSegmentClass(strength: PasswordStrength) {
  if (strength === "weak") {
    return styles.passwordStrengthSegmentWeak;
  }

  if (strength === "medium") {
    return styles.passwordStrengthSegmentMedium;
  }

  if (strength === "strong") {
    return styles.passwordStrengthSegmentStrong;
  }

  return "";
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordPageFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordPageFallback() {
  return (
    <main className={styles.resetPage}>
      <div className={styles.backdropGlow} />
      <div className={styles.backdropGrid} />

      <section className={styles.resetShell}>
        <div className={styles.heroPanel}>
          <span className={styles.heroBadge}>
            <span className={styles.heroBadgeIcon}>
              <ShieldIcon />
            </span>
            Recuperação protegida
          </span>

          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Acesso seguro</p>
            <h1>Crie uma nova senha para voltar ao painel.</h1>
            <p>
              Estamos preparando a validação do seu link para que a redefinição
              aconteça com segurança.
            </p>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <p className={styles.formTag}>Nova senha</p>
            <h2>Redefinir acesso</h2>
            <p>Carregando os dados do link de recuperação.</p>
          </div>

          <div className={styles.formCard}>
            <div className={styles.statusCard}>
              <span className={styles.submitSpinner} aria-hidden="true" />
              <strong>Validando link</strong>
              <p>Estamos conferindo se o token ainda pode ser utilizado.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startRouteTransition } = useRouteTransition();

  const token = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordFeedback = getPasswordFeedback(password);
  const shouldShowPasswordGuidance = password.trim().length > 0;

  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!token) {
        setTokenError("Link de redefinicao ausente ou invalido.");
        setIsCheckingToken(false);
        return;
      }

      setIsCheckingToken(true);
      setTokenError("");
      setSubmitError("");
      setSuccessMessage("");

      try {
        const response = await validatePasswordResetToken({ token });

        if (!isMounted) {
          return;
        }

        setAccountName(response.user.name);
        setAccountEmail(response.user.email);
      } catch (err: unknown) {
        if (!isMounted) {
          return;
        }

        setTokenError(
          getApiErrorMessage(err, "Nao foi possivel validar o link de redefinicao."),
        );
      } finally {
        if (isMounted) {
          setIsCheckingToken(false);
        }
      }
    }

    void validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || tokenError) {
      return;
    }

    if (!isValidPassword(password)) {
      setSubmitError(
        "A senha deve ter no mínimo 6 caracteres e pelo menos 1 caractere especial.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await resetPassword({ token, password });

      setSuccessMessage(
        response.message || "Senha redefinida com sucesso. Redirecionando...",
      );
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        startRouteTransition({
          label: "Voltando para o login",
          minDuration: 700,
        });
        router.push("/login");
      }, 1400);
    } catch (err: unknown) {
      setSubmitError(
        getApiErrorMessage(err, "Não foi possível redefinir a senha."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.resetPage}>
      <div className={styles.backdropGlow} />
      <div className={styles.backdropGrid} />

      <section className={styles.resetShell}>
        <div className={styles.heroPanel}>
          <span className={styles.heroBadge}>
            <span className={styles.heroBadgeIcon}>
              <ShieldIcon />
            </span>
            Recuperação protegida
          </span>

          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Acesso seguro</p>
            <h1>Crie uma nova senha para voltar ao painel.</h1>
            <p>
              Este link e temporário e foi criado para redefinir seu acesso com
              segurança. Depois da troca, links anteriores deixam de funcionar.
            </p>
          </div>

          <div className={styles.heroList}>
            <article className={styles.heroCard}>
              <strong>Link temporario</strong>
              <span>O token expira automaticamente para reduzir riscos.</span>
            </article>
            <article className={styles.heroCard}>
              <strong>Senha atualizada</strong>
              <span>A nova senha passa a valer assim que a redefinição termina.</span>
            </article>
            <article className={styles.heroCard}>
              <strong>Acesso rápido</strong>
              <span>Depois da troca, voce volta para o login e entra normalmente.</span>
            </article>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <p className={styles.formTag}>Nova senha</p>
            <h2>Redefinir acesso</h2>
            <p>
              Use uma senha forte e confirme os dados antes de salvar a
              alteração.
            </p>
          </div>

          <div className={styles.formCard}>
            {isCheckingToken ? (
              <div className={styles.statusCard}>
                <span className={styles.submitSpinner} aria-hidden="true" />
                <strong>Validando link</strong>
                <p>Estamos conferindo se o token ainda pode ser utilizado.</p>
              </div>
            ) : tokenError ? (
              <div className={styles.statusCard}>
                <div className={styles.errorBox} role="alert" aria-live="polite">
                  {tokenError}
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => router.push("/login")}
                >
                  Voltar para o login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.formContent}>
                <div className={styles.accountSummary}>
                  <span className={styles.accountLabel}>Conta validada</span>
                  <strong>{accountName || "Usuario"}</strong>
                  <span>{accountEmail}</span>
                </div>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nova senha</span>
                  <span
                    className={`${styles.fieldControl} ${styles.fieldControlPassword}`}
                  >
                    <span className={styles.fieldIcon}>
                      <LockIcon />
                    </span>
                    <input
                      type={isPasswordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Digite a nova senha"
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

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Confirmar senha</span>
                  <span
                    className={`${styles.fieldControl} ${styles.fieldControlPassword}`}
                  >
                    <span className={styles.fieldIcon}>
                      <LockIcon />
                    </span>
                    <input
                      type={isConfirmPasswordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                    <PasswordVisibilityButton
                      visible={isConfirmPasswordVisible}
                      onClick={() =>
                        setIsConfirmPasswordVisible((current) => !current)
                      }
                      className={styles.fieldVisibilityButton}
                    />
                  </span>
                </label>

                <p className={styles.requirements}>
                  Use no mínimo 6 caracteres e pelo menos 1 caractere especial.
                </p>

                {shouldShowPasswordGuidance ? (
                  <div className={styles.passwordStrength} aria-live="polite">
                    <div className={styles.passwordStrengthHeader}>
                      <span className={styles.passwordStrengthCaption}>
                        Força da senha
                      </span>
                      <strong
                        className={`${styles.passwordStrengthLabel} ${getStrengthLabelClass(
                          passwordFeedback.strength,
                        )}`}
                      >
                        {passwordFeedback.label}
                      </strong>
                    </div>

                    <div
                      className={styles.passwordStrengthMeter}
                      aria-hidden="true"
                    >
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`${styles.passwordStrengthSegment} ${
                            passwordFeedback.level >= level
                              ? styles.passwordStrengthSegmentActive
                              : ""
                          } ${getStrengthSegmentClass(passwordFeedback.strength)}`}
                        />
                      ))}
                    </div>

                    <div className={styles.passwordRequirements}>
                      <p
                        className={`${styles.passwordRequirement} ${
                          passwordFeedback.hasMinLength
                            ? styles.passwordRequirementMet
                            : ""
                        }`}
                      >
                        Mínimo de 6 caracteres
                      </p>
                      <p
                        className={`${styles.passwordRequirement} ${
                          passwordFeedback.hasSpecialCharacter
                            ? styles.passwordRequirementMet
                            : ""
                        }`}
                      >
                        1 caractere especial
                      </p>
                    </div>
                  </div>
                ) : null}

                {submitError ? (
                  <div
                    className={styles.errorBox}
                    role="alert"
                    aria-live="polite"
                  >
                    {submitError}
                  </div>
                ) : null}

                {successMessage ? (
                  <div
                    className={styles.successBox}
                    role="status"
                    aria-live="polite"
                  >
                    {successMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting || Boolean(successMessage)}
                  className={styles.submitButton}
                >
                  <span className={styles.submitButtonContent}>
                    {isSubmitting ? (
                      <span className={styles.submitSpinner} aria-hidden="true" />
                    ) : null}
                    <span>
                      {isSubmitting ? "Salvando..." : "Salvar nova senha"}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => router.push("/login")}
                >
                  Cancelar e voltar ao login
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
