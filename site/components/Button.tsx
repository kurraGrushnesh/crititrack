import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

/**
 * The one button. Renders a `<button>`, or a `<Link>` when `href` is
 * given. Three variants, two sizes, all from design tokens — no
 * per-call colour or padding.
 *
 *   primary  solid brand, white label — the main action
 *   ghost    hairline border — a secondary action beside a primary
 *   subtle   filled grey — low-emphasis, or on a busy surface
 */

type Variant = "primary" | "ghost" | "subtle";
type Size = "sm" | "md";

interface Base {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

type ButtonProps = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
  };

type LinkProps = Base &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
    href: string;
  };

export default function Button(props: ButtonProps | LinkProps) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    children,
    ...rest
  } = props;

  const cls = ["ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, className]
    .filter(Boolean)
    .join(" ");

  if (typeof props.href === "string") {
    const { href, ...anchor } = rest as Omit<LinkProps, keyof Base>;
    return (
      <Link href={href} className={cls} {...anchor}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={cls}
      {...(rest as Omit<ButtonProps, keyof Base>)}
    >
      {children}
    </button>
  );
}
