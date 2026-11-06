import { contractLines, fullFrameAsked, type ReelContract } from "@fauve/agent";

// Her Reel's frame (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »): the whole
// vertical frame by default, her videos whole on black only when she asks for it (the contract's `frame`, read once in
// her words; a format she asks for is never a layout of hers: settleFrame). The chain draws it (plan.frame, Letterbox in
// Reel.tsx); a model plays its format's band (skillFramed). docs/monteur.md, « Vidéos horizontales entières sur du
// noir »; docs/modeles.md, « Réglages d'un modèle ».

/**
 * Her contract as a model's filler reads it: its lines without the editor's line on her frame (the engine's letterbox is
 * not a model's), and her frame apart (« cadre » of its input: its format's band, or none).
 */
export function skillContract(contract: ReelContract | undefined): { contract: string[]; frame?: "letterbox" } {
  return {
    contract: contractLines(contract ? { ...contract, frame: "vertical" } : undefined),
    ...(contract?.frame === "letterbox" ? { frame: "letterbox" as const } : {}),
  };
}

/**
 * Whether the chain lays this version's videos whole on black: her contract asks for it, or the version a correction
 * corrects had it and her correction does not ask for the whole vertical frame again (« remets-le en vertical plein
 * écran »: the contract's frame is « vertical » whether she said it or not).
 */
export function chainLetterbox(input: { contract?: Pick<ReelContract, "frame">; correction: boolean; base?: { frame?: string } | null; brief?: string }): boolean {
  if (input.contract?.frame === "letterbox") return true;
  return input.correction && input.base?.frame === "letterbox" && !fullFrameAsked(input.brief);
}
