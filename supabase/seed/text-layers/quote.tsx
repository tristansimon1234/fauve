// @layer {"id":"5d6f0a1e-0c1b-4c8e-9a01-000000000005","name":"Citation","description":"Une citation ou un témoignage : de grands guillemets aux couleurs du studio, la phrase en italique élégant, le nom de la personne dessous. Sur un voile sombre pour se lire sur n'importe quelle photo.","fonts":[],"slots":[{"name":"quote","role":"citation","max_chars":180,"multiline":false},{"name":"author","role":"auteur","max_chars":40,"multiline":false}],"sample":{"quote":"Le meilleur accueil du quartier, on s'y sent comme à la maison.","author":"Camille, cliente depuis 2 ans"}}
function Layer({ width, height, brand, texts }) {
  const serif = `"${brand.displayFont}", serif`;
  const sans = `"${brand.bodyFont}", sans-serif`;
  return (
    <AbsoluteFill style={{ background: "rgba(20,14,36,0.5)" }}>
      <svg width="150" height="120" viewBox="0 0 150 120" style={{ position: "absolute", left: 90, top: 300 }}>
        <path d="M10 110V70C10 35 30 12 62 6l6 14C48 28 40 42 40 60h28v50zm76 0V70c0-35 20-58 52-64l6 14c-20 8-28 22-28 40h28v50z" fill={brand.accent} />
      </svg>
      <FitText style={{ position: "absolute", left: 90, top: 460, width: 900, height: 470 }} innerStyle={{ alignItems: "flex-start", textAlign: "left", fontFamily: serif, fontStyle: "italic", fontSize: 84, lineHeight: 1.12, color: "#fff" }}>
        {texts.quote ?? "Ta citation"}
      </FitText>
      <FitText style={{ position: "absolute", left: 90, top: 980, width: 900, height: 70 }} innerStyle={{ flexDirection: "row", justifyContent: "flex-start", gap: 20 }}>
        <span style={{ width: 54, height: 3, background: brand.accent }} />
        <span style={{ color: "#fff", fontFamily: sans, fontWeight: 700, fontSize: 32, letterSpacing: "0.04em" }}>{texts.author ?? ""}</span>
      </FitText>
    </AbsoluteFill>
  );
}
