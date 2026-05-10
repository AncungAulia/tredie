import TokenDetail from "@/modules/tokens/TokenDetail";

export default async function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <TokenDetail id={resolvedParams.id} />;
}
