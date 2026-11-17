import type { ReactNode } from 'react';

interface HomeSectionHeadingProps {
  readonly action?: ReactNode;
  readonly id: string;
  readonly title: string;
  readonly titleClassName?: string;
}

export function HomeSectionHeading({
  action,
  id,
  title,
  titleClassName = 'text-text-primary',
}: HomeSectionHeadingProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <h2
          className={`flex shrink-0 items-center gap-2 font-heading text-xl font-semibold sm:text-2xl ${titleClassName}`}
          id={id}
        >
          <span aria-hidden="true" className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand-bright" />
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
