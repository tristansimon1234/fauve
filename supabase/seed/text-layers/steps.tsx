// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000006","name":"Étapes numérotées","description":"Des étapes ou des conseils numérotés : un titre, puis chaque étape avec son numéro dans un rond aux couleurs du studio et une courte explication. Pour un tutoriel, une routine, « 3 raisons de… ».","fonts":[],"slots":[{"name":"title","role":"titre","max_chars":60,"multiline":false},{"name":"steps","role":"étapes (titre | explication)","max_chars":400,"multiline":true}],"sample":{"title":"Comment commander","steps":"Choisissez | Sur notre site ou en boutique.\nOn prépare | Votre commande est prête en 2 h.\nVous récupérez | Ou on vous livre dans le quartier."}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  const steps = (texts.steps ?? "Première étape | Une explication")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const [head, ...rest] = l.split("|");
      return { head: head.trim(), detail: rest.join("|").trim() };
    });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.55) 100%)" }}>
      <FitText style={{ position: "absolute", left: 84, top: 100, width: 912, height: 220 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontSize: 96, lineHeight: 1.02, color: "#fff" }}>
        {texts.title ?? "Ton titre"}
      </FitText>
      <FitText style={{ position: "absolute", left: 84, top: 370, width: 912, height: 900 }} innerStyle={{ alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 50 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 84, height: 84, borderRadius: 999, background: brand.accent, color: brand.accentInk, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 800, fontSize: 42 }}>
                {i + 1}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
                <span style={{ color: "#fff", fontFamily: sans, fontWeight: 800, fontSize: 44, lineHeight: 1.15 }}>{s.head}</span>
                {s.detail ? <span style={{ color: "rgba(255,255,255,0.9)", fontFamily: sans, fontSize: 32, lineHeight: 1.3 }}>{s.detail}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </FitText>
    </AbsoluteFill>
  );
}
