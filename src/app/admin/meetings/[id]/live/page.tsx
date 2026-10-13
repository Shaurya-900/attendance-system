import { LiveBoard } from "./live-board";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveBoard meetingId={id} />;
}
