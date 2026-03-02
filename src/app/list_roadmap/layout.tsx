import ProtectedPage from '@/components/ProtectedPage';

export default function ListRoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedPage>{children}</ProtectedPage>;
}
