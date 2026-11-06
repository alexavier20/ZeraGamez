type PageHeadingProps = Readonly<{
  title: string;
  subtitle?: string;
  titleClassName?: string;
}>;

export function PageHeading({ title, subtitle, titleClassName }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1
        className={
          titleClassName ??
          'font-heading text-2xl leading-tight font-bold text-content-primary sm:text-[27px] lg:text-[30px]'
        }
      >
        {title}
      </h1>
      {subtitle && <p className="text-xs leading-5 text-text-muted sm:text-sm">{subtitle}</p>}
    </div>
  );
}
