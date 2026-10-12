import type { Metadata } from "next";
import { UploadIcon } from "@/components/icons";
import { Orb } from "@/components/orb";

export const metadata: Metadata = { title: "Médiathèque" };

export default function LibraryPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Médiathèque</h1>
        <p className="text-[15px] text-muted">Tes vidéos et photos, en pleine qualité.</p>
      </div>
      <div className="flex max-w-[760px] flex-col items-center gap-4 rounded-[22px] border-[1.5px] border-dashed border-lilac bg-violet-tint px-6 py-14 text-center">
        <Orb size={56} />
        <h2 className="text-lg font-bold">Dépose tes vidéos ici</h2>
        <p className="max-w-[420px] text-sm leading-relaxed text-muted">
          Les fichiers déposés ici gardent leur qualité d’origine, contrairement à WhatsApp. Pense à avoir l’accord des
          élèves filmés.
        </p>
        <button type="button" className="btn btn-primary" disabled>
          <UploadIcon size={18} />
          Choisir des fichiers
        </button>
        <span className="text-xs text-muted">Bientôt disponible</span>
      </div>
    </main>
  );
}
