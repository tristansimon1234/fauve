// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000004","name":"Planning en carte","description":"Un planning lisible dans une carte claire : un titre, puis une ligne par créneau (jour | heure | quoi), séparées par de fins filets. Pour un planning, des horaires d'ouverture, un menu de la semaine, des dates d'événements.","fonts":[],"slots":[{"name":"title","role":"titre","max_chars":40,"multiline":false},{"name":"rows","role":"créneaux (jour | heure | quoi)","max_chars":400,"multiline":true},{"name":"note","role":"petite note en bas","max_chars":60,"multiline":false}],"sample":{"title":"Nos horaires","rows":"Mar | 9h – 19h | Sur rendez-vous\nMer | 9h – 19h | Sans rendez-vous\nJeu | 10h – 20h | Nocturne\nVen | 9h – 19h | \nSam | 9h – 17h | ","note":"Réservation en ligne, lien en bio"}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  const rows = (texts.rows ?? "Lun | 18h | Cours")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((r) => r.split("|").map((c) => c.trim()));
  return (
    <AbsoluteFill style={{ background: "rgba(0,0,0,0.12)" }}>
      <div style={{ position: "absolute", left: 70, top: 150, width: 940, height: 1050, background: "rgba(251,247,244,0.94)", borderRadius: 36, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }} />
      <FitText style={{ position: "absolute", left: 130, top: 210, width: 820, height: 140 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontStyle: "italic", fontSize: 92, lineHeight: 1, color: brand.ink }}>
        {texts.title ?? "Cette semaine"}
      </FitText>
      <FitText style={{ position: "absolute", left: 130, top: 380, width: 820, height: 700 }} innerStyle={{ alignItems: "stretch", justifyContent: "flex-start", textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((cells, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 28, padding: "22px 0", borderTop: i ? "1.5px solid rgba(28,21,48,0.12)" : "none" }}>
              <span style={{ width: 110, fontFamily: sans, fontWeight: 800, fontSize: 34, color: brand.accent, textTransform: "uppercase" }}>{cells[0] ?? ""}</span>
              <span style={{ width: 130, fontFamily: sans, fontWeight: 600, fontSize: 34, color: brand.ink }}>{cells[1] ?? ""}</span>
              <span style={{ flex: 1, fontFamily: sans, fontSize: 34, color: brand.ink }}>{cells.slice(2).join(" ")}</span>
            </div>
          ))}
        </div>
      </FitText>
      {texts.note ? (
        <FitText style={{ position: "absolute", left: 130, top: 1100, width: 820, height: 60 }} innerStyle={{ alignItems: "flex-start", fontFamily: sans, fontSize: 28, color: "rgba(28,21,48,0.6)" }}>
          {texts.note}
        </FitText>
      ) : null}
    </AbsoluteFill>
  );
}
