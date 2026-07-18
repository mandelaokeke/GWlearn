import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import type { BrowserAWSConfig } from "./aws-config.ts";

export interface AuthenticatedSession {
  accessToken: string;
  email: string;
}

function userPool(config: BrowserAWSConfig) {
  return new CognitoUserPool({
    ClientId: config.userPoolClientId,
    UserPoolId: config.userPoolId,
  });
}

export function emailFromIdToken(payload: Record<string, unknown>, fallback: string): string {
  const email = payload.email;
  return typeof email === "string" && email.trim() ? email : fallback;
}

function sessionValue(
  email: string,
  session: CognitoUserSession,
): AuthenticatedSession {
  return {
    accessToken: session.getAccessToken().getJwtToken(),
    email: emailFromIdToken(session.getIdToken().payload, email),
  };
}

export function restoreSession(
  config: BrowserAWSConfig,
): Promise<AuthenticatedSession | null> {
  const user = userPool(config).getCurrentUser();
  if (!user) return Promise.resolve(null);

  return new Promise((resolve) => {
    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      if (error || !session?.isValid()) return resolve(null);
      resolve(sessionValue(user.getUsername(), session));
    });
  });
}

export function signIn(
  config: BrowserAWSConfig,
  email: string,
  password: string,
): Promise<AuthenticatedSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = new CognitoUser({
    Pool: userPool(config),
    Username: normalizedEmail,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(
      new AuthenticationDetails({
        Password: password,
        Username: normalizedEmail,
      }),
      {
        onFailure: reject,
        onSuccess: (session) => resolve(sessionValue(normalizedEmail, session)),
      },
    );
  });
}

export function signUp(
  config: BrowserAWSConfig,
  email: string,
  password: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  return new Promise((resolve, reject) => {
    userPool(config).signUp(
      normalizedEmail,
      password,
      [new CognitoUserAttribute({ Name: "email", Value: normalizedEmail })],
      [],
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

export function confirmSignUp(
  config: BrowserAWSConfig,
  email: string,
  confirmationCode: string,
): Promise<void> {
  const user = new CognitoUser({
    Pool: userPool(config),
    Username: email.trim().toLowerCase(),
  });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(confirmationCode.trim(), true, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

export function signOut(config: BrowserAWSConfig): void {
  userPool(config).getCurrentUser()?.signOut();
}
