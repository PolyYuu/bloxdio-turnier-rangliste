(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const SIGNUP_URL = `${SUPABASE_URL}/functions/v1/hub-signup`;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const form = document.querySelector("#registerForm");
  const codeInput = document.querySelector("#registrationCode");
  const passwordInput = document.querySelector("#password");
  const repeatInput = document.querySelector("#passwordRepeat");
  const submitButton = document.querySelector("#submitButton");
  const message = document.querySelector("#message");

  const preset = new URLSearchParams(location.search).get("code");
  if (preset) codeInput.value = preset.trim();

  function show(text, type = "") {
    message.textContent = text;
    message.className = `message ${type}`.trim();
  }

  codeInput.addEventListener("input", () => {
    const value = codeInput.value.replace(/\s+/g, "");
    codeInput.value = value.startsWith("SGR1.") ? value : value.toUpperCase();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    show("");

    let registrationCode = codeInput.value.trim().replace(/\s+/g, "");
    if (!registrationCode.startsWith("SGR1.")) registrationCode = registrationCode.toUpperCase();
    const password = passwordInput.value;
    const repeat = repeatInput.value;

    const legacyValid = /^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(registrationCode);
    const signedValid = /^SGR1\.[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{20,40}$/.test(registrationCode);
    if (!legacyValid && !signedValid) {
      show("Bitte gib den vollständigen Registrierungscode aus Bloxd ein.", "error");
      return;
    }
    if (password.length < 8) {
      show("Das Passwort muss mindestens 8 Zeichen lang sein.", "error");
      return;
    }
    if (password !== repeat) {
      show("Die beiden Passwörter stimmen nicht überein.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "VERKNÜPFE…";

    try {
      const response = await fetch(SIGNUP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY
        },
        body: JSON.stringify({ registrationCode, password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Account konnte nicht verknüpft werden.");

      const session = result.session;
      if (!session?.access_token || !session?.refresh_token) {
        throw new Error("Account wurde erstellt, aber die Sitzung konnte nicht gestartet werden.");
      }

      const { error: sessionError } = await db.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      if (sessionError) throw sessionError;

      show(`Profil ${result.username || ""} erfolgreich übernommen.`, "success");
      setTimeout(() => { location.href = "index.html#profile"; }, 900);
    } catch (error) {
      console.error(error);
      show(error?.message || "Account konnte nicht verknüpft werden.", "error");
      submitButton.disabled = false;
      submitButton.textContent = "ACCOUNT VERKNÜPFEN";
    }
  });
})();
