// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000001","name":"Checklist surlignée","description":"Titre en capitales en haut, puis une liste à cases cochées : chaque élément a un titre surligné et une ligne de détail. Pour une checklist, « ce qu'il faut apporter », des conseils.","fonts":[],"slots":[{"name":"title","role":"titre","max_chars":40,"multiline":false},{"name":"items","role":"éléments (titre | détail)","max_chars":400,"multiline":true}],"sample":{"title":"Avant votre rendez-vous","items":"Arrivez 5 minutes avant | Pour prendre le temps de vous installer.\nVenez cheveux secs | Le diagnostic est plus précis.\nApportez une photo | De la coupe ou de la couleur qui vous inspire.\nPrévenez-nous en cas d'empêchement | 24 h avant, pour libérer le créneau."}}
function Layer({ width, height, brand, texts }) {
  const title = texts.title ?? "Checklist";
  const items = (texts.items ?? "Premier point | Un détail")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const [head, ...rest] = line.split("|");
      return { head: head.trim(), detail: rest.join("|").trim() };
    });
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.42) 100%)" }}>
      <FitText
        style={{ position: "absolute", left: 84, top: 110, width: 912, height: 150 }}
        innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontSize: 104, lineHeight: 1, color: "#fff", textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.35)" }}
      >
        {title}
      </FitText>
      <FitText style={{ position: "absolute", left: 84, top: 310, width: 912, height: 950 }} innerStyle={{ alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 46 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
              <svg width="58" height="58" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
                <rect x="2.2" y="2.2" width="19.6" height="19.6" fill="none" stroke="#fff" strokeWidth="1.5" />
                <path d="M6.2 12.4l3.9 3.9L19.6 5.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
                <div style={{ fontFamily: serif, fontSize: 46, lineHeight: 1.32, textTransform: "uppercase" }}>
                  <span style={{ background: brand.cream, color: brand.ink, padding: "2px 12px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{item.head}</span>
                </div>
                {item.detail ? (
                  <span style={{ color: "#fff", fontFamily: sans, fontSize: 31, lineHeight: 1.32, textShadow: "0 1px 10px rgba(0,0,0,0.45)" }}>{item.detail}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </FitText>
    </AbsoluteFill>
  );
}
