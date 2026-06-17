import { BottomNav } from "@/components/BottomNav";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-safe">
      {children}
      <BottomNav />
    </div>
  );
}
