type PageHeadingProps = Readonly<{
  title: string;
  subtitle: string;
}>;

export function PageHeading({ title, subtitle }: PageHeadingProps) {
  return (
    <header className="flex flex-col gap-[18px] sm:gap-[22px] lg:gap-2">
      <h1 className="font-heading text-[27px] leading-[34px] font-bold text-content-primary sm:text-[30px] sm:leading-[38px] lg:text-[38px] lg:leading-[48px]">
        {title}
      </h1>
      <p className="text-[13px] leading-[17px] text-text-muted sm:text-sm sm:leading-[18px] lg:text-base lg:leading-[21px]">
        {subtitle}
      </p>
    </header>
  );
}
