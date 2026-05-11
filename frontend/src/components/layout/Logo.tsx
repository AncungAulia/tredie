import Link from "next/link";
import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/topics"
      className={`shrink-0 flex items-center gap-2 ${className}`}
    >
      <Image
        src="/tredie-favicon.svg"
        alt="Tredie"
        width={32}
        height={32}
        className="md:block hidden"
      />
      <Image
        src="/tredie-icon-logo.svg"
        alt="Tredie"
        width={80}
        height={20}
        className="h-3.5 w-auto"
      />
    </Link>
  );
}
