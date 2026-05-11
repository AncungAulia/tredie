import Topics from "@/modules/topics/Topics";

export default function TopicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topics />
      {children}
    </>
  );
}
