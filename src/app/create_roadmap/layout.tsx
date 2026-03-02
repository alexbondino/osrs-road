import ProtectedPage from '@/components/ProtectedPage';

export default function CreateRoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedPage>{children}</ProtectedPage>;
}
