import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for heading roles across public, dashboard, and
 * admin surfaces. Replaces the ad hoc mix of font-black/font-bold/
 * font-extrabold and orange/violet eyebrow colors found across the app.
 */
const headingVariants = cva("tracking-tight text-foreground", {
  variants: {
    variant: {
      eyebrow: "text-xs font-bold uppercase tracking-widest text-primary sm:text-sm",
      "page-title": "font-bold",
      "section-title": "font-semibold",
    },
    size: {
      compact: "", // dashboard/admin scale
      large: "", // public marketing scale
    },
  },
  compoundVariants: [
    { variant: "page-title", size: "compact", class: "text-2xl sm:text-3xl" },
    { variant: "page-title", size: "large", class: "text-3xl sm:text-4xl lg:text-5xl" },
    { variant: "section-title", size: "compact", class: "text-lg sm:text-xl" },
    { variant: "section-title", size: "large", class: "text-xl sm:text-2xl" },
  ],
  defaultVariants: { variant: "page-title", size: "compact" },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant, size, as, ...props }, ref) => {
    const Comp = as ?? (variant === "eyebrow" ? "p" : "h1");
    return (
      <Comp
        ref={ref as React.Ref<HTMLHeadingElement>}
        className={cn(headingVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Heading.displayName = "Heading";

export { Heading, headingVariants };
