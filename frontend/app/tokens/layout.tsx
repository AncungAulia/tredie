import Tokens from "@/modules/tokens/Tokens";

export default function TokensLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Tokens />
      {children}
    </>
  );
}
