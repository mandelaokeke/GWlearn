"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MAX_VIDEO_BYTES } from "../packages/contracts/video.ts";
import { browserAWSConfig } from "../packages/browser/aws-config.ts";
import type { BrowserAWSConfigInput } from "../packages/browser/aws-config.ts";
import {
  confirmSignUp,
  restoreSession,
  signIn,
  signOut,
  signUp,
  type AuthenticatedSession,
} from "../packages/browser/cognito-auth.ts";
import {
  allowedContentType,
  hashBlobSha256,
  postFileToGrant,
  requestUploadGrant,
} from "../packages/browser/direct-upload.ts";

type AuthView = "sign-in" | "sign-up" | "confirm";
type UploadPhase =
  | "idle"
  | "hashing"
  | "requesting"
  | "uploading"
  | "complete"
  | "error";

function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  if (/not authorized|incorrect username|incorrect password/i.test(error.message)) {
    return "That email and password combination was not accepted.";
  }
  if (/password/i.test(error.message)) {
    return "Use at least eight characters with uppercase, lowercase, a number, and a symbol.";
  }
  if (/user.*exist/i.test(error.message)) {
    return "An account already exists for this email. Try signing in.";
  }
  if (/code|confirm/i.test(error.message)) {
    return "That confirmation code was not accepted. Check the latest email and try again.";
  }
  return error.message || "Something went wrong. Please try again.";
}

export function UploadWorkspace({
  configurationInput,
}: {
  configurationInput?: BrowserAWSConfigInput;
}) {
  const configuration = useMemo(
    () => browserAWSConfig(configurationInput),
    [configurationInput],
  );
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [authView, setAuthView] = useState<AuthView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [title, setTitle] = useState("");
  const [languageCode, setLanguageCode] = useState("en-US");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    if (!configuration.configured) return;
    restoreSession(configuration.value).then(setSession).catch(() => setSession(null));
  }, [configuration]);

  if (!configuration.configured) {
    return (
      <section className="upload-section" id="upload">
        <div className="upload-intro">
          <p className="eyebrow">Live AWS vertical slice</p>
          <h2>The upload path is built. Deployment activates the controls.</h2>
          <p>
            This portfolio checkout intentionally shows its boundary: Cognito and the
            API endpoint must be deployed before private lecture uploads become active.
          </p>
        </div>
        <div className="deployment-card" aria-label="AWS upload deployment status">
          <span className="deployment-badge">READY TO CONFIGURE</span>
          <h3>Authenticated intake, without a fake success state.</h3>
          <ol>
            <li><span>01</span> Deploy the TypeScript CDK stack.</li>
            <li><span>02</span> Add its public API and Cognito outputs.</li>
            <li><span>03</span> Rebuild to unlock sign-in and direct upload.</li>
          </ol>
          <p>Private media storage and owner-scoped metadata are already covered by automated infrastructure tests.</p>
        </div>
      </section>
    );
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration.configured) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authView === "sign-up") {
        await signUp(configuration.value, email, password);
        setAuthView("confirm");
        setAuthMessage("We sent a confirmation code to your email.");
      } else if (authView === "confirm") {
        await confirmSignUp(configuration.value, email, confirmationCode);
        setAuthView("sign-in");
        setAuthMessage("Account confirmed. Sign in to upload your lecture.");
      } else {
        setSession(await signIn(configuration.value, email, password));
        setPassword("");
      }
    } catch (error) {
      setAuthMessage(friendlyError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration.configured || !session || !file) return;
    const contentType = allowedContentType(file);
    if (!contentType) {
      setPhase("error");
      return setUploadMessage("Choose an MP4, MOV, or WebM video.");
    }
    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) {
      setPhase("error");
      return setUploadMessage("Choose a non-empty video no larger than 2 GiB.");
    }

    setUploadMessage("");
    setProgress(0);
    try {
      setPhase("hashing");
      const checksumSha256 = await hashBlobSha256(file, (value) =>
        setProgress(Math.round(value * 25)),
      );
      setPhase("requesting");
      const grant = await requestUploadGrant({
        accessToken: session.accessToken,
        apiUrl: configuration.value.apiUrl,
        metadata: {
          checksumSha256,
          contentType,
          fileName: file.name,
          languageCode,
          sizeBytes: file.size,
          title: title.trim(),
        },
      });
      setProgress(30);
      setPhase("uploading");
      await postFileToGrant(grant, file, (value) =>
        setProgress(30 + Math.round(value * 70)),
      );
      setProgress(100);
      setPhase("complete");
      setUploadMessage(
        `Upload complete. Video ${grant.videoId} is now being transcribed and turned into study materials.`,
      );
    } catch (error) {
      setPhase("error");
      setUploadMessage(friendlyError(error));
    }
  }

  return (
    <section className="upload-section" id="upload">
      <div className="upload-intro">
        <p className="eyebrow">Try the real intake flow</p>
        <h2>One secure path from your browser to private storage.</h2>
        <p>
          Identity comes from Cognito. The API creates the owner-scoped record.
          Your video travels directly to S3 through a fifteen-minute grant.
        </p>
        <ul className="upload-assurances">
          <li>Private by default</li>
          <li>Checksum verified</li>
          <li>2 GiB upload ceiling</li>
        </ul>
      </div>

      <div className="intake-card">
        {session ? (
          <>
            <div className="signed-in-row">
              <div><span>Signed in</span><strong>{session.email}</strong></div>
              <button
                type="button"
                onClick={() => {
                  signOut(configuration.value);
                  setSession(null);
                  setPhase("idle");
                }}
              >
                Sign out
              </button>
            </div>

            <form className="upload-form" onSubmit={handleUpload}>
              <label>
                Lecture title
                <input
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Zero Trust Fundamentals"
                  required
                  value={title}
                />
              </label>
              <label>
                Spoken language
                <select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-US">Spanish (US)</option>
                  <option value="fr-FR">French</option>
                </select>
              </label>
              <label className="file-field">
                Lecture video
                <input
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
                <span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "MP4, MOV, or WebM · up to 2 GiB"}</span>
              </label>

              {phase !== "idle" && (
                <div className={`upload-status upload-status-${phase}`} aria-live="polite">
                  <div><span>{phase === "complete" ? "Ready" : phase}</span><strong>{progress}%</strong></div>
                  <progress max="100" value={progress}>{progress}%</progress>
                  {uploadMessage && <p>{uploadMessage}</p>}
                </div>
              )}

              <button className="intake-submit" disabled={phase === "hashing" || phase === "requesting" || phase === "uploading"} type="submit">
                {phase === "hashing" ? "Verifying video…" : phase === "uploading" ? "Uploading privately…" : "Start secure upload"}
              </button>
            </form>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="auth-heading">
              <span>{authView === "sign-up" ? "Create account" : authView === "confirm" ? "Confirm email" : "Welcome back"}</span>
              <strong>{authView === "confirm" ? "Enter the code from Cognito." : "Sign in to upload privately."}</strong>
            </div>
            <label>
              Email
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            {authView !== "confirm" && (
              <label>
                Password
                <input autoComplete={authView === "sign-up" ? "new-password" : "current-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>
            )}
            {authView === "confirm" && (
              <label>
                Confirmation code
                <input autoComplete="one-time-code" inputMode="numeric" onChange={(event) => setConfirmationCode(event.target.value)} required value={confirmationCode} />
              </label>
            )}
            {authMessage && <p className="form-message" aria-live="polite">{authMessage}</p>}
            <button className="intake-submit" disabled={authBusy} type="submit">
              {authBusy ? "Please wait…" : authView === "sign-up" ? "Create account" : authView === "confirm" ? "Confirm email" : "Sign in"}
            </button>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthMessage("");
                setAuthView(authView === "sign-in" ? "sign-up" : "sign-in");
              }}
            >
              {authView === "sign-in" ? "New to GWLearn? Create an account" : "Already registered? Sign in"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
