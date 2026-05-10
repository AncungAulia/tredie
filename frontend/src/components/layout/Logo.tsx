import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/topics" className="shrink-0 flex items-center gap-2">
      <Image src="/tredie-favicon.svg" alt="Tredie" width={32} height={32} />
      <span className="text-[#FAFAFA] font-sans font-bold text-lg tracking-wide ">
        Tredie.
      </span>
    </Link>
  );
}
