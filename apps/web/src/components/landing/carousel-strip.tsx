/* eslint-disable @next/next/no-img-element -- images from the landing's public bucket, already sized */

// The hair salon carousel of the landing (Maison Maya, a salon d'exemple), its four slides side by side.
const BASE = "https://tfxkhktofgtljlqlksba.supabase.co/storage/v1/object/public/landing";
const SLIDES = ["carrousel-1.jpg", "carrousel-2.jpg", "carrousel-3.jpg", "carrousel-4.jpg"];

export function CarouselStrip() {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {SLIDES.map((file, i) => (
        <img
          key={file}
          src={`${BASE}/${file}`}
          alt={`Diapositive ${i + 1} d’un carrousel conseils pour un salon de coiffure`}
          loading="lazy"
          className="aspect-[4/5] w-[62vw] max-w-[280px] shrink-0 snap-center rounded-[18px] object-cover shadow-[0_30px_60px_-34px_rgba(28,21,48,.5)] md:w-full md:max-w-none"
        />
      ))}
    </div>
  );
}
