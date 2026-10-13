// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000003","name":"Offre dans un rond","description":"Une offre mise en avant : un grand rond aux couleurs du studio avec le prix ou la remise, un titre, une ligne de détail et un bouton d'appel. Pour une promotion, des places restantes, un tarif.","fonts":[],"slots":[{"name":"badge","role":"prix ou remise","max_chars":10,"multiline":false},{"name":"badge_note","role":"petit texte sous le prix","max_chars":24,"multiline":false},{"name":"title","role":"titre de l'offre","max_chars":60,"multiline":false},{"name":"detail","role":"détail","max_chars":120,"multiline":false},{"name":"cta","role":"appel à l'action","max_chars":30,"multiline":false}],"sample":{"badge":"-20 %","badge_note":"jusqu'à dimanche","title":"Le menu du midi","detail":"Entrée, plat et dessert, du mardi au vendredi.","cta":"Réservez en bio"}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.6) 100%)" }}>
      <div style={{ position: "absolute", left: 650, top: 90, width: 340, height: 340, borderRadius: 999, background: brand.accent, boxShadow: "0 18px 50px rgba(0,0,0,0.3)", transform: "rotate(-8deg)" }}>
        <FitText style={{ position: "absolute", left: 40, top: 70, width: 260, height: 140 }} innerStyle={{ color: brand.accentInk, fontFamily: sans, fontWeight: 800, fontSize: 110, lineHeight: 1, whiteSpace: "nowrap" }}>
          {texts.badge ?? "-20 %"}
        </FitText>
        <FitText style={{ position: "absolute", left: 60, top: 215, width: 220, height: 46 }} innerStyle={{ color: brand.accentInk, fontFamily: sans, fontWeight: 600, fontSize: 28, whiteSpace: "nowrap" }}>
          {texts.badge_note ?? ""}
        </FitText>
      </div>
      <FitText style={{ position: "absolute", left: 84, top: 860, width: 912, height: 190 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontSize: 96, lineHeight: 1.02, color: "#fff" }}>
        {texts.title ?? "Ton offre"}
      </FitText>
      <FitText style={{ position: "absolute", left: 84, top: 1060, width: 912, height: 90 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: sans, fontSize: 34, lineHeight: 1.3, color: "rgba(255,255,255,0.92)" }}>
        {texts.detail ?? ""}
      </FitText>
      {texts.cta ? (
        <FitText style={{ position: "absolute", left: 84, top: 1175, width: 600, height: 96 }} innerStyle={{ alignItems: "flex-start" }}>
          <span style={{ background: "#fff", color: brand.ink, borderRadius: 999, padding: "18px 36px", fontFamily: sans, fontWeight: 700, fontSize: 32 }}>{texts.cta}</span>
        </FitText>
      ) : null}
    </AbsoluteFill>
  );
}
