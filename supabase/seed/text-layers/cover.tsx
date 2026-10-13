// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000002","name":"Couverture éditoriale","description":"Couverture de carrousel : un petit surtitre entre deux filets, un grand titre élégant en bas de la photo sur un dégradé sombre, une ligne d'appel. Pour la 1re photo d'un carrousel.","fonts":[],"slots":[{"name":"kicker","role":"surtitre","max_chars":30,"multiline":false},{"name":"title","role":"grand titre","max_chars":60,"multiline":false},{"name":"subtitle","role":"ligne d'appel","max_chars":70,"multiline":false}],"sample":{"kicker":"Nouveauté","title":"La collection d'automne est là","subtitle":"Glisse pour tout voir →"}}
function Layer({ width, height, brand, texts }) {
  const kicker = texts.kicker ?? "Nouveau";
  const title = texts.title ?? "Ton titre";
  const subtitle = texts.subtitle ?? "";
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.72) 100%)" }}>
      <FitText style={{ position: "absolute", left: 90, top: 760, width: 900, height: 70 }} innerStyle={{ flexDirection: "row", gap: 22 }}>
        <span style={{ width: 70, height: 2, background: "rgba(255,255,255,0.85)" }} />
        <span style={{ color: "#fff", fontFamily: sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase" }}>{kicker}</span>
        <span style={{ width: 70, height: 2, background: "rgba(255,255,255,0.85)" }} />
      </FitText>
      <FitText style={{ position: "absolute", left: 90, top: 850, width: 900, height: 280 }} innerStyle={{ fontFamily: serif, fontStyle: "italic", fontSize: 120, lineHeight: 1.02, color: "#fff", textShadow: "0 4px 30px rgba(0,0,0,0.35)" }}>
        {title}
      </FitText>
      {subtitle ? (
        <FitText style={{ position: "absolute", left: 90, top: 1160, width: 900, height: 70 }} innerStyle={{ color: "rgba(255,255,255,0.92)", fontFamily: sans, fontWeight: 600, fontSize: 34 }}>
          {subtitle}
        </FitText>
      ) : null}
    </AbsoluteFill>
  );
}
