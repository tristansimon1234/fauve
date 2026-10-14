import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Orb } from "@/components/orb";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 pt-14 pb-8">
      <Orb size={72} className="self-center" />
      <div className="flex flex-col gap-2.5 text-center">
        <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">
          Content de te <span className="accent">revoir</span>
        </h1>
        <p className="text-[15px] leading-[1.55] text-muted">
          Entre le numéro avec lequel tu écris à Fauve. Ton code arrive sur WhatsApp.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-[13px] text-muted">
        Pas de code reçu ?{" "}
        <Link href="/commencer?connexion" className="font-semibold text-violet hover:underline">
          Se connecter avec un message WhatsApp
        </Link>
      </p>
    </div>
  );
}
