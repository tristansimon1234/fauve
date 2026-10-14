"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";
import { checkPairing, startPairing } from "./actions";

// « Commencer » on a computer: a QR code opens WhatsApp on the phone with a
// message already written (« Bonjour Fauve ! Code : … »). Once it is sent, this
// screen opens the app by itself. On a phone, the button opens WhatsApp directly.

type Pair = { code: string; url: string; qr: string };

export function Pairing({ signIn, expired }: { signIn: boolean; expired: boolean }) {
  const [pair, setPair] = useState<Pair | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "ready" | "expired" | "error">("loading");

  const request = () =>
    startPairing()
      .then(async ({ code, text }) => {
        const url = whatsappLink(text);
        const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1C1530", light: "#FFFFFF" } });
        setPair({ code, url, qr });
        setState("waiting");
      })
      .catch(() => setState("error"));
  const start = () => {
    setState("loading");
    void request();
  };
  useEffect(() => {
    void request();
  }, []);

  // Wait for the message (every 2 s while the tab is open).
  useEffect(() => {
    if (state !== "waiting") return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      checkPairing()
        .then((s) => {
          if (s === "ready") {
            setState("ready");
            // A full navigation: the route sets the session cookies and redirects.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/auth/pair";
          } else if (s === "expired") setState("expired");
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [state]);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 pt-12 pb-8 text-center">
      <Orb size={64} />
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
          {signIn ? (
            <>
              Connecte-toi avec <span className="accent">WhatsApp</span>
            </>
          ) : (
            <>
              On fait <span className="accent">connaissance</span>
            </>
          )}
        </h1>
        <p className="text-[15px] leading-[1.55] text-muted">
          {signIn
            ? "Scanne ce code avec ton téléphone et envoie le message à Simone : ton compte s’ouvre ici."
            : "Scanne ce code avec ton téléphone et envoie le message à Simone. Ton espace s’ouvre ici, et on continue sur cet écran."}
        </p>
      </div>

      {state === "ready" ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Orb size={44} />
          <p className="text-[15px] font-semibold">C’est bon, j’ouvre ton espace…</p>
        </div>
      ) : state === "expired" || state === "error" || expired ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-[15px] text-muted">{state === "error" ? "Le code n’a pas pu être créé." : "Ce code a expiré."}</p>
          <button type="button" onClick={start} className="btn btn-primary h-11">
            Nouveau code
          </button>
        </div>
      ) : (
        <>
          <div className="flex size-[232px] items-center justify-center rounded-[24px] border border-line bg-white p-4 shadow-[0_12px_40px_rgba(28,21,48,.08)]">
            {pair ? <div className="size-full [&_svg]:size-full" aria-label="QR code pour écrire à Simone" role="img" dangerouslySetInnerHTML={{ __html: pair.qr }} /> : <Orb size={36} />}
          </div>
          {pair && (
            <p className="text-[13px] text-muted">
              Ton code : <strong className="font-mono text-[15px] tracking-[0.18em] text-ink">{pair.code}</strong>
            </p>
          )}
          <a href={pair?.url ?? "#"} target="_blank" rel="noreferrer" className={`btn btn-primary h-12 px-6 ${pair ? "" : "pointer-events-none opacity-40"}`}>
            <WhatsAppIcon size={18} />
            Ouvrir WhatsApp
          </a>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span className="fauve-pulse size-2 rounded-full bg-violet" aria-hidden />
            J’attends ton message…
          </p>
        </>
      )}

      <p className="mt-auto text-[13px] text-muted">
        {signIn ? (
          <>
            Tu préfères un code ?{" "}
            <Link href="/connexion" className="font-semibold text-violet hover:underline">
              Recevoir un code
            </Link>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <Link href="/commencer?connexion" className="font-semibold text-violet hover:underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
