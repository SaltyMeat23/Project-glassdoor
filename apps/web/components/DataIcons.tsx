// Data-availability icons for company tiles/profiles: Pay · Retirement ·
// Insurance · Leave. Inline SVG (self-contained, no icon lib — SECURITY §8.2).
// Lit (brand) when we have the data, faint otherwise; labeled for a11y (not
// color-only).

type IconProps = { size?: number };

const S = ({ size = 15, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const Pay = (p: IconProps) => (
  <S {...p}>
    <line x1="12" y1="2.5" x2="12" y2="21.5" />
    <path d="M16.5 6.5a4 4 0 0 0-4-2h-1a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6h-1a4 4 0 0 1-4-2" />
  </S>
);
const Retirement = (p: IconProps) => (
  <S {...p}>
    <path d="M3 10 12 4l9 6" />
    <path d="M5 10v9M19 10v9M9 10v9M15 10v9" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </S>
);
const Insurance = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M12 9v5M9.5 11.5h5" />
  </S>
);
const Leave = (p: IconProps) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </S>
);

export const DATA_ICONS = [
  { key: 'has_pay', label: 'Pay', Icon: Pay },
  { key: 'has_retirement', label: 'Retirement', Icon: Retirement },
  { key: 'has_insurance', label: 'Insurance', Icon: Insurance },
  { key: 'has_leave', label: 'Leave', Icon: Leave },
] as const;

export function DataRow({ flags, size = 15 }: { flags: Record<string, boolean>; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {DATA_ICONS.map(({ key, label, Icon }) => {
        const on = !!flags[key];
        return (
          <span
            key={key}
            title={`${label}: ${on ? 'available' : 'no data yet'}`}
            aria-label={`${label}: ${on ? 'available' : 'no data yet'}`}
            className={on ? 'text-brand-2' : 'text-faint/45'}
          >
            <Icon size={size} />
          </span>
        );
      })}
    </div>
  );
}
