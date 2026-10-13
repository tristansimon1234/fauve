// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000007","name":"Chiffre clé","description":"Un chiffre énorme qui frappe (« 3 places », « 500 clients », « 10 ans »), un intitulé dessous et une petite phrase. Pour une annonce, un anniversaire, des places restantes.","fonts":[],"slots":[{"name":"number","role":"chiffre","max_chars":10,"multiline":false},{"name":"label","role":"intitulé","max_chars":40,"multiline":false},{"name":"caption","role":"petite phrase","max_chars":100,"multiline":false}],"sample":{"number":"10","label":"ans ce mois-ci","caption":"Merci à vous ! Une surprise vous attend en boutique toute la semaine."}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }}>
      <FitText style={{ position: "absolute", left: 84, top: 420, width: 912, height: 420 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontSize: 400, lineHeight: 0.9, color: "#fff", textShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        {texts.number ?? "3"}
      </FitText>
      <FitText style={{ position: "absolute", left: 84, top: 860, width: 912, height: 130 }} innerStyle={{ alignItems: "flex-start", textAlign: "left" }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 64, lineHeight: 1.35, textTransform: "uppercase" }}>
          <span style={{ background: brand.accent, color: brand.accentInk, padding: "4px 18px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{texts.label ?? "places"}</span>
        </div>
      </FitText>
      <FitText style={{ position: "absolute", left: 84, top: 1030, width: 912, height: 150 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: sans, fontSize: 38, lineHeight: 1.3, color: "#fff" }}>
        {texts.caption ?? ""}
      </FitText>
    </AbsoluteFill>
  );
}
