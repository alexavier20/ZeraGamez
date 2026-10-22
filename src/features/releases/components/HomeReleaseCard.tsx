import { Gamepad2 } from 'lucide-react';
import { Link } from 'react-router';

import {
  desktopPlatformLabels,
  type ReleaseItem,
} from '@/features/releases/model/release-presentation';

interface HomeReleaseCardProps {
  readonly item: ReleaseItem;
}

export function HomeReleaseCard({ item }: HomeReleaseCardProps) {
  const platforms = desktopPlatformLabels(item.platforms);

  return (
    <article className="min-w-0">
      <Link
        aria-label={`Ver detalhes de ${item.name}`}
        className="group block overflow-hidden rounded-xl bg-bg-secondary shadow-[0_8px_24px_#00000040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        to={`/jogos/${String(item.id)}`}
      >
        {item.coverUrl ? (
          <img
            alt={`Capa de ${item.name}`}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            src={item.coverUrl}
          />
        ) : (
          <span
            aria-label={`Capa indisponível de ${item.name}`}
            className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-bg-secondary to-surface-hover text-text-muted"
            role="img"
          >
            <Gamepad2 aria-hidden="true" size={36} />
          </span>
        )}
      </Link>

      <div className="mt-2.5 min-w-0">
        <h3 className="truncate text-sm font-semibold text-text-primary" title={item.name}>
          <Link
            className="rounded-sm hover:text-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            to={`/jogos/${String(item.id)}`}
          >
            {item.name}
          </Link>
        </h3>
        {platforms.length > 0 ? (
          <ul aria-label={`Plataformas de ${item.name}`} className="mt-2 flex flex-wrap gap-1.5">
            {platforms.map((platform, index) => (
              <li
                className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-text-muted"
                key={`${String(item.platforms[index]?.id ?? platform)}-${platform}`}
              >
                {platform}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
