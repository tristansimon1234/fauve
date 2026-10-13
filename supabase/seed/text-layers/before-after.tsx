// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000009","name":"Avant / après","description":"Deux étiquettes « Avant » et « Après » en haut de la photo (pour une photo partagée en deux, ou deux photos du carrousel) et une phrase en bas. Pour une transformation : coiffure, rénovation, posture.","fonts":[],"slots":[{"name":"left","role":"étiquette de gauche","max_chars":16,"multiline":false},{"name":"right","role":"étiquette de droite","max_chars":16,"multiline":false},{"name":"caption","role":"phrase du bas","max_chars":100,"multiline":false}],"sample":{"left":"Avant","right":"Après","caption":"Balayage miel et coupe dégradée, 2 h 30 de soin."}}
function Layer({ width, height, brand, texts }) {
  const sans = `"${brand.bodyFont}", sans-serif`;
  const serif = `"${brand.displayFont}", serif`;
  const tag = (text, left) => (
    <FitText style={{ position: "absolute", left, top: 70, width: 380, height: 90 }} innerStyle={{}}>
      <span style={{ background: "rgba(20,14,36,0.78)", color: "#fff", borderRadius: 999, padding: "14px 34px", fontFamily: sans, fontWeight: 800, fontSize: 36, letterSpacing: "0.12em", textTransform: "uppercase" }}>{text}</span>
    </FitText>
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 65%, rgba(0,0,0,0.6) 100%)" }}>
      <div style={{ position: "absolute", left: 539, top: 0, width: 2, height: 1350, background: "rgba(255,255,255,0.7)" }} />
      {tag(texts.left ?? "Avant", 80)}
      {tag(texts.right ?? "Après", 620)}
      <FitText style={{ position: "absolute", left: 84, top: 1150, width: 912, height: 130 }} innerStyle={{ fontFamily: serif, fontStyle: "italic", fontSize: 54, lineHeight: 1.15, color: "#fff" }}>
        {texts.caption ?? ""}
      </FitText>
    </AbsoluteFill>
  );
}
