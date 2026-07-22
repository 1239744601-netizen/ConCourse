import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function functionBody(name, nextName){
  const pattern = new RegExp(`function ${name}\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}\\n\\nfunction ${nextName}`);
  const match = html.match(pattern);
  assert.ok(match, `${name} should remain available for auth regression tests`);
  return match[1];
}

test("verification email can be resent without re-entering registration details", () => {
  assert.match(html, /id="authResendBtn"[^>]*data-i18n="resendVerification"/);
  assert.match(html, /authClient\.auth\.resend\(\{\s*type:"signup",\s*email,/);
  assert.match(html, /emailRedirectTo:AUTH_EMAIL_REDIRECT_URL/);
  assert.match(html, /startAuthResendCooldown\(60\)/);
  assert.match(html, /setAuthMode\("verify", \{clearMessage:false\}\)/);
});

test("signup verification uses a manual six-digit OTP instead of consuming an email link", () => {
  assert.match(html, /id="authVerificationCode"[^>]*inputmode="numeric"[^>]*autocomplete="one-time-code"[^>]*maxlength="6"/);
  assert.match(html, /authClient\.auth\.verifyOtp\(\{ email, token, type:"email" \}\)/);
  assert.match(html, /mode === "signup" \|\| mode === "verify"/);
  assert.match(html, /authMode === "verify" \? pendingVerificationEmail/);
  assert.match(html, /\$\("authEmail"\)\.readOnly = verifying/);

  const submitBody = functionBody("submitAuth", "initializeAccount");
  assert.ok(
    submitBody.indexOf('if(mode === "verify")') < submitBody.indexOf('password.length < 8'),
    "OTP verification must run before password validation because the password field is hidden"
  );
  assert.match(submitBody, /pendingVerificationEmail = "";[\s\S]*applySession\(result\.data\.session\)/);
});

test("Supabase email and sign-in failures map to clear user messages", () => {
  const mapError = new Function("error", functionBody("authErrorTranslationKey", "friendlyAuthError"));

  assert.equal(mapError({code:"email_address_not_authorized"}), "authEmailNotAuthorized");
  assert.equal(mapError({code:"over_email_send_rate_limit"}), "authEmailRateLimited");
  assert.equal(mapError({status:429}), "authRateLimited");
  assert.equal(mapError({status:429, code:"over_email_send_rate_limit"}), "authEmailRateLimited");
  assert.equal(mapError({message:"Email rate limit exceeded"}), "authEmailRateLimited");
  assert.equal(mapError({code:"user_already_exists"}), "authAlreadyRegistered");
  assert.equal(mapError({message:"User already registered"}), "authAlreadyRegistered");
  assert.equal(mapError({code:"email_not_confirmed"}), "authEmailNotConfirmed");
  assert.equal(mapError({code:"invalid_credentials"}), "authInvalidLogin");
  assert.equal(mapError({code:"otp_expired"}), "authLinkExpired");
});

test("signup acknowledgement does not promise that an email was delivered", () => {
  const english = html.match(/accountCreated:"([^"]+)"[^\n]*signedInSuccess:"Signed in successfully\."/);
  assert.ok(english, "English registration acknowledgement should exist");
  assert.doesNotMatch(english[1], /check your email|email (?:was|has been) sent/i);
  assert.match(english[1], /if .* is eligible/i);

  assert.equal((html.match(/verificationEmailMissing:/g) || []).length, 3);
  assert.equal((html.match(/authEmailNotAuthorized:/g) || []).length, 3);
  assert.equal((html.match(/authLinkExpired:/g) || []).length, 3);
});

test("authentication callback errors are read from query strings and URL fragments", () => {
  const readCallbackError = new Function(
    "window",
    "URLSearchParams",
    functionBody("readAuthCallbackError", "clearAuthCallbackError")
  );

  assert.deepEqual(
    readCallbackError({location:{search:"?error=access_denied&error_code=otp_expired&error_description=Expired", hash:""}}, URLSearchParams),
    {code:"otp_expired", message:"Expired"}
  );
  assert.deepEqual(
    readCallbackError({location:{search:"", hash:"#error=access_denied&error_description=Invalid+link"}}, URLSearchParams),
    {code:"access_denied", message:"Invalid link"}
  );
  assert.equal(readCallbackError({location:{search:"", hash:""}}, URLSearchParams), null);
  assert.match(html, /if\(callbackError\) showAuthCallbackError\(callbackError\)/);
});

test("handled callback errors are removed without disturbing unrelated URL state", () => {
  const clearCallbackError = new Function(
    "window",
    "URL",
    "URLSearchParams",
    functionBody("clearAuthCallbackError", "showAuthCallbackError")
  );
  const replacements = [];
  const fakeWindow = {
    location:{href:"https://example.test/ConCourse/?error=access_denied&keep=1#error_code=otp_expired&post=42"},
    history:{
      state:{safe:true},
      replaceState(state, title, url){ replacements.push({state, title, url}); }
    }
  };

  clearCallbackError(fakeWindow, URL, URLSearchParams);
  assert.deepEqual(replacements, [{state:{safe:true}, title:"", url:"/ConCourse/?keep=1#post=42"}]);
  assert.match(html, /setFriendlyAuthError\(error, "authLinkInvalid"\)/);
  assert.doesNotMatch(functionBody("showAuthCallbackError", "renderAuthResendButton"), /error_description|\.message/);
});

test("auth status survives a language switch and invalid emails never reach Supabase", () => {
  assert.match(html, /setAuthMode\(authMode, \{clearMessage:false, focus:false\}\)/);
  assert.match(html, /function setAuthMessageKey\(/);
  assert.match(html, /if\(!validAuthEmail\(email\) \|\| password\.length < 8\)/);
  assert.match(html, /\$\("authPassword"\)\.value = "";/);
});

test("OTP instructions are translated in English, Mandarin, and Cantonese", () => {
  for(const key of [
    "verificationSubtitle",
    "verificationNote",
    "verificationCodeTitle",
    "verificationCodeHelp",
    "verifyEmail",
    "verifyingEmail",
    "invalidVerificationCode",
    "verificationCodeExpired",
    "emailVerified",
    "useDifferentEmail"
  ]){
    assert.equal((html.match(new RegExp(`${key}:`, "g")) || []).length, 3, `${key} should exist in all three languages`);
  }
});
