import type { ComponentProps } from "react";

type Variant = "filled" | "outline" | "inverse";

const variants: Record<Variant, string> = {
  filled: "bg-ink text-eggshell hover:bg-graphite",
  outline:
    "bg-eggshell text-ink border border-hairline hover:border-ink shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.075)]",
  inverse: "bg-eggshell text-ink hover:bg-taupe",
};

export function PillLink({
  variant = "filled",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  return (
    <a
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
