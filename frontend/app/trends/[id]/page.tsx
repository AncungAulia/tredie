import TokenDetail from "@/modules/tokens/TokenDetail";

export default async function TrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TokenDetail id={id} />;
}
