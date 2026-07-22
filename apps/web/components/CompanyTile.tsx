import Link from 'next/link';
import { CompanyLogo } from './CompanyLogo';
import { DataRow } from './DataIcons';
import type { CompanyTileRow } from '@/lib/engine/companies';

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function CompanyTile({ c }: { c: CompanyTileRow }) {
  const anyData = c.has_pay || c.has_retirement || c.has_insurance || c.has_leave;
  return (
    <Link
      href={`/companies/${c.slug}`}
      className="group flex flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-2 hover:bg-panel-2"
    >
      <CompanyLogo name={c.display_name} />
      <div className="mt-3 min-w-0">
        <p className="truncate font-display text-[15px] font-semibold group-hover:text-white">
          {c.display_name}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-faint">
          {c.industry ? titleize(c.industry) : anyData ? 'Cleared employer' : 'No data yet'}
        </p>
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <DataRow flags={c as unknown as Record<string, boolean>} />
      </div>
    </Link>
  );
}
