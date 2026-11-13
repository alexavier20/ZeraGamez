type PageHeadingProps = Readonly<{
  title: string;
  subtitle?: string;
  titleClassName?: string;
  titleAccent?: boolean;
}>;

export function PageHeading({
  title,
  subtitle,
  titleClassName,
  titleAccent = false,
}: PageHeadingProps) {
  const baseTitleClassName =
    titleClassName ??
    'font-heading text-2xl leading-tight font-bold text-content-primary sm:text-[27px] lg:text-[30px]';
  const resolvedTitleClassName = titleAccent
    ? `${baseTitleClassName} flex items-center gap-2`
    : baseTitleClassName;

  return (
    <div className="flex flex-col gap-2">
      <h1 className={resolvedTitleClassName}>
        {titleAccent ? (
          <span
            aria-hidden="true"
            className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand"
          />
        ) : null}
        {title}
      </h1>
      {subtitle && <p className="text-xs leading-5 text-text-muted sm:text-sm">{subtitle}</p>}
    </div>
  );
}
