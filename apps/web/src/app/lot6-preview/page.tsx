// Temporary local preview (not committed).
import { Logo } from "@/components/orb";
import { Mascot, type MascotMood } from "@/components/mascot";
const moods: MascotMood[] = ["idle", "thinking", "laugh", "happy", "surprised", "sad", "cry", "angry", "shy"];
export default function Preview() {
  return (
    <main className="flex flex-col gap-8 bg-white p-10">
      <div className="flex items-center gap-10"><Logo /><Logo size={30} /><div className="bg-ink p-4 text-white"><Logo /></div></div>
      <div className="flex flex-wrap items-end gap-6">
        {moods.map((m) => (<div key={m} className="flex flex-col items-center gap-1"><Mascot size={96} mood={m} /><span className="mono-label text-muted">{m}</span></div>))}
      </div>
    </main>
  );
}
