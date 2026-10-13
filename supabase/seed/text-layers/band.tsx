// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000008","name":"Carte du bas","description":"Une carte claire arrondie en bas de la photo : un petit libellé coloré, un titre et un texte court. Discret, la photo reste au premier plan. Pour une info, une nouveauté, un message.","fonts":[],"slots":[{"name":"tag","role":"libellé","max_chars":24,"multiline":false},{"name":"title","role":"titre","max_chars":60,"multiline":false},{"name":"text","role":"texte","max_chars":160,"multiline":false}],"sample":{"tag":"Nouveau","title":"Ouvert le dimanche","text":"Dès ce week-end, de 10h à 13h, tout le mois de décembre."}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 60, top: 880, width: 960, height: 410, background: "rgba(255,255,255,0.95)", borderRadius: 34, boxShadow: "0 20px 50px rgba(0,0,0,0.22)" }} />
      <FitText style={{ position: "absolute", left: 120, top: 930, width: 840, height: 60 }} innerStyle={{ alignItems: "flex-start" }}>
        <span style={{ background: brand.accent, color: brand.accentInk, borderRadius: 999, padding: "8px 22px", fontFamily: sans, fontWeight: 800, fontSize: 26, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {texts.tag ?? "Info"}
        </span>
      </FitText>
      <FitText style={{ position: "absolute", left: 120, top: 1010, width: 840, height: 130 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontSize: 70, lineHeight: 1.05, color: brand.ink }}>
        {texts.title ?? "Ton titre"}
      </FitText>
      <FitText style={{ position: "absolute", left: 120, top: 1150, width: 840, height: 100 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: sans, fontSize: 32, lineHeight: 1.32, color: "rgba(28,21,48,0.75)" }}>
        {texts.text ?? ""}
      </FitText>
    </AbsoluteFill>
  );
}
