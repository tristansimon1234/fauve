"use client";

import { HASHTAG, HASHTAGS_MAX, RULE_MAX, RULES_MAX, TONE_MAX, type StyleForm } from "./style-options";
import { FoldedSection, HashtagInput, RuleList, Segmented, inputClass } from "./ui";

const CAPTION_OPTIONS = [
  { value: "short", label: "Courtes" },
  { value: "medium", label: "Moyennes" },
  { value: "long", label: "Longues" },
] as const;

const EMOJI_OPTIONS = [
  { value: "none", label: "Aucun" },
  { value: "few", label: "Quelques-uns" },
  { value: "many", label: "Beaucoup" },
] as const;

type ToneFields = Pick<StyleForm, "tone" | "caption_length" | "emojis" | "hashtags" | "dos" | "donts">;

export function ToneSection({ value, onChange }: { value: ToneFields; onChange: (patch: Partial<ToneFields>) => void }) {
  return (
    <FoldedSection title="Légendes" hint="Ton, longueur, emojis, hashtags et règles des légendes Instagram.">
      <div className="flex flex-col gap-2">
        <label htmlFor="style-tone-input" className="text-[13px] font-bold">
          Ton
        </label>
        <input
          id="style-tone-input"
          value={value.tone}
          maxLength={TONE_MAX}
          onChange={(e) => onChange({ tone: e.target.value })}
          placeholder="Doux, phrases courtes, un peu d’humour"
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Segmented
          legend="Longueur des légendes"
          name="caption-length"
          value={value.caption_length}
          options={CAPTION_OPTIONS}
          onChange={(caption_length) => onChange({ caption_length })}
        />
        <Segmented
          legend="Emojis dans les légendes"
          name="emojis"
          value={value.emojis}
          options={EMOJI_OPTIONS}
          onChange={(emojis) => onChange({ emojis })}
        />
      </div>
      <HashtagInput
        value={value.hashtags}
        max={HASHTAGS_MAX}
        validate={(tag) => HASHTAG.test(tag)}
        onChange={(hashtags) => onChange({ hashtags })}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <RuleList
          label="À faire"
          addLabel="Ajouter une règle"
          placeholder="Montrer les mains et les machines"
          value={value.dos}
          max={RULES_MAX}
          maxLength={RULE_MAX}
          onChange={(dos) => onChange({ dos })}
        />
        <RuleList
          label="À éviter"
          addLabel="Ajouter une règle"
          placeholder="Les visages des clients sans accord"
          value={value.donts}
          max={RULES_MAX}
          maxLength={RULE_MAX}
          onChange={(donts) => onChange({ donts })}
        />
      </div>
    </FoldedSection>
  );
}
