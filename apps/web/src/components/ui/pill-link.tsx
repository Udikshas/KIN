import type { ComponentProps } from "react";

type Variant = "filled" | "soft" | "inverse";

const variants: Record<Variant, string> = {
  filled: "bg-charcoal text-cloud hover:bg-black",
  soft: "bg-cloud text-ink hover:bg-line",
  inverse: "bg-paper text-ink hover:bg-cloud",
};

export function PillLink({
  variant = "filled",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-9 px-4 text-[15px]", md: "h-11 px-5 text-base", lg: "h-13 px-7 text-[17px]" }[size];
  return (
    <a
      className={`inline-flex items-center justify-center gap-2 rounded-[128px] font-medium transition-colors ${sizes} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
