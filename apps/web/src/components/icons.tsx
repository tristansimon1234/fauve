import type { SVGProps } from "react";

// Stroke icons from the mockup (24×24, 1.8 stroke). Never emoji in the UI.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode, defaults: Partial<IconProps> = {}) {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...defaults}
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const ChatIcon = make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />);
export const CalendarIcon = make(
  <>
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);
export const ImageIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </>,
);
export const FolderIcon = make(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const ChartIcon = make(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </>,
);
export const SlidersIcon = make(
  <>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </>,
);
export const InstagramIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" />
  </>,
);
export const TikTokIcon = make(
  <>
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
    <path d="M14 3c.5 2.5 2.5 4.5 5 5" />
  </>,
);
export const WhatsAppIcon = make(
  <>
    <path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.8z" />
    <path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1.2-1.2 1.8.8-.4 1.6c-3.6.4-7.2-3.2-6.8-6.8l1.6-.4.8 1.8z" />
  </>,
);
export const UploadIcon = make(
  <>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </>,
);
export const CheckIcon = make(<path d="M20 6 9 17l-5-5" />, { strokeWidth: 2.2 });
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const ArrowLeftIcon = make(<path d="M19 12H5M11 18l-6-6 6-6" />);
export const ArrowUpIcon = make(<path d="M12 19V5M5 12l7-7 7 7" />, { strokeWidth: 2.2 });
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const PenIcon = make(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </>,
);
export const FilmIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" />
  </>,
);
export const BulbIcon = make(
  <>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </>,
);
export const MegaphoneIcon = make(
  <>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
  </>,
);
export const ReplyIcon = make(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 5 5v6" />
  </>,
);
export const RepeatIcon = make(
  <>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </>,
);
export const PaperclipIcon = make(
  <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />,
);
export const MicIcon = make(
  <>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
  </>,
);
export const PlayIcon = make(<polygon points="8 5 19 12 8 19 8 5" />, { fill: "currentColor", stroke: "none" });
export const PaletteIcon = make(
  <>
    <path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z" />
    <circle cx="7.5" cy="11" r="1.2" />
    <circle cx="10.5" cy="7" r="1.2" />
    <circle cx="15.5" cy="7.5" r="1.2" />
  </>,
);
export const ArrowDownIcon = make(<path d="M12 5v14M19 12l-7 7-7-7" />, { strokeWidth: 2.2 });
export const XIcon = make(<path d="M18 6 6 18M6 6l12 12" />);
export const TrashIcon = make(
  <>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </>,
);
export const SmileIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
    <path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.6} />
  </>,
);
export const GridIcon = make(
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
  </>,
);
export const LayersIcon = make(
  <>
    <rect x="7" y="7" width="13" height="13" rx="2.5" />
    <path d="M4 15.5V6.5A2.5 2.5 0 0 1 6.5 4h9" />
  </>,
);
export const EyeIcon = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
);
