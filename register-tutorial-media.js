(() => {
  "use strict";

  const STEPS = {
    de: [
      {
        title: "KLICKE AUF „CODE HOLEN“",
        copy: "Klicke auf „CODE HOLEN“. Der HUB öffnet unsere Survival-Games-Welt in Bloxd in einem neuen Tab.",
        alt: "Registrierungsseite mit hervorgehobener Schaltfläche CODE HOLEN."
      },
      {
        title: "GIB /register EIN",
        copy: "Öffne im Spiel den Chat, gib /register ein und sende den Befehl ab.",
        alt: "Bloxd-Chat mit eingegebenem Befehl /register."
      },
      {
        title: "ÜBERNIMM DEINEN CODE",
        copy: "Bloxd zeigt dir einen persönlichen 8-Zeichen-Code. Kehre zum HUB zurück, gib diesen Code ein, wähle dein Passwort und klicke auf „ACCOUNT ERSTELLEN“.",
        alt: "Bloxd zeigt einen Registrierungscode, der auf der HUB-Registrierungsseite eingetragen wird."
      },
      {
        title: "VERIFIZIERUNG AUSSTEHEND",
        copy: "Direkt nach der Account-Erstellung ist dein Profil zunächst „Pending“. Name, Statistiken, Rating und frühere Turniere bleiben verborgen, bis deine permanente Bloxd-ID bestätigt wurde.",
        alt: "HUB-Profil im Pending-Zustand mit ausstehender Bloxd-Verifizierung."
      },
      {
        title: "FERTIG VERIFIZIERT",
        copy: "Nach erfolgreicher Verifizierung übernimmt der HUB automatisch deinen echten Bloxd-Namen und deine permanente Bloxd-ID. Dein normales Profil, deine Statistiken und deine Turnierdaten werden freigeschaltet.",
        alt: "Vollständig verifiziertes HUB-Spielerprofil mit Name, Rang und Statistiken."
      }
    ],
    en: [
      {
        title: "CLICK “GET CODE”",
        copy: "Click “GET CODE”. The HUB opens our Survival Games world in Bloxd in a new tab.",
        alt: "Registration page with the GET CODE button highlighted."
      },
      {
        title: "TYPE /register",
        copy: "Open the in-game chat, type /register and send the command.",
        alt: "Bloxd chat with the /register command entered."
      },
      {
        title: "USE YOUR CODE",
        copy: "Bloxd shows your personal 8-character code. Return to the HUB, enter the code, choose your password and click “CREATE ACCOUNT”.",
        alt: "Bloxd shows a registration code that is entered on the HUB registration page."
      },
      {
        title: "VERIFICATION PENDING",
        copy: "Right after account creation, your profile is shown as “Pending”. Your name, statistics, rating and previous tournaments stay hidden until your permanent Bloxd ID has been confirmed.",
        alt: "HUB profile in Pending state while Bloxd verification is outstanding."
      },
      {
        title: "VERIFICATION COMPLETE",
        copy: "After successful verification, the HUB automatically imports your real Bloxd name and permanent Bloxd ID. Your normal profile, statistics and tournament data become available.",
        alt: "Fully verified HUB player profile with name, rank and statistics."
      }
    ],
    fr: [
      {
        title: "CLIQUE SUR « OBTENIR LE CODE »",
        copy: "Clique sur « OBTENIR LE CODE ». Le HUB ouvre notre monde Survival Games dans Bloxd dans un nouvel onglet.",
        alt: "Page d’inscription avec le bouton OBTENIR LE CODE mis en évidence."
      },
      {
        title: "ENTRE /register",
        copy: "Ouvre le chat dans le jeu, entre /register puis envoie la commande.",
        alt: "Chat Bloxd avec la commande /register saisie."
      },
      {
        title: "UTILISE TON CODE",
        copy: "Bloxd affiche ton code personnel à 8 caractères. Reviens dans le HUB, saisis le code, choisis ton mot de passe puis clique sur « CRÉER LE COMPTE ».",
        alt: "Bloxd affiche un code d’inscription qui est saisi sur la page d’inscription du HUB."
      },
      {
        title: "VÉRIFICATION EN ATTENTE",
        copy: "Juste après la création du compte, ton profil reste d’abord « Pending ». Ton nom, tes statistiques, ton classement et tes anciens tournois restent masqués jusqu’à la confirmation de ton identifiant Bloxd permanent.",
        alt: "Profil HUB en état Pending pendant la vérification Bloxd."
      },
      {
        title: "VÉRIFICATION TERMINÉE",
        copy: "Après la vérification, le HUB importe automatiquement ton vrai nom Bloxd et ton identifiant permanent. Ton profil normal, tes statistiques et tes données de tournoi deviennent disponibles.",
        alt: "Profil joueur HUB entièrement vérifié avec nom, rang et statistiques."
      }
    ]
  };

  const IMAGES = [
    "assets/register/tutorial-step-1.webp",
    "assets/register/tutorial-step-2.webp",
    "assets/register/tutorial-step-3.webp",
    "assets/register/tutorial-step-4.webp",
    "assets/register/tutorial-step-5.webp"
  ];

  let queued = false;

  function getLanguage() {
    const value = String(document.documentElement.lang || "de").toLowerCase();
    if (value.startsWith("fr")) return "fr";
    if (value.startsWith("en")) return "en";
    return "de";
  }

  function getStepIndex() {
    const text = document.querySelector("#tutorialCount")?.textContent || "1";
    const parsed = Number.parseInt(text, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(IMAGES.length - 1, parsed - 1));
  }

  function renderRealStep() {
    const title = document.querySelector("#tutorialTitle");
    const copy = document.querySelector("#tutorialCopy");
    const visual = document.querySelector("#tutorialVisual");
    if (!title || !copy || !visual) return;

    const language = getLanguage();
    const index = getStepIndex();
    const step = STEPS[language][index];

    title.textContent = step.title;
    copy.textContent = step.copy;

    let image = visual.querySelector("img[data-tutorial-screenshot]");
    if (!image || image.getAttribute("src") !== IMAGES[index]) {
      visual.replaceChildren();
      image = document.createElement("img");
      image.dataset.tutorialScreenshot = "true";
      image.src = IMAGES[index];
      image.loading = "eager";
      image.decoding = "async";
      visual.appendChild(image);
    }
    image.alt = step.alt;
  }

  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderRealStep();
    });
  }

  function init() {
    const count = document.querySelector("#tutorialCount");
    if (count) {
      new MutationObserver(queueRender).observe(count, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    new MutationObserver(queueRender).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"]
    });

    document.querySelectorAll("#tutorialTrigger, #tutorialBack, #tutorialNext, [data-lang]")
      .forEach((element) => element.addEventListener("click", queueRender));

    queueRender();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();