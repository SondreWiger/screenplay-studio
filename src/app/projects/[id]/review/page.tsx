import { redirect } from 'next/navigation';

export default function ReviewRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/share`);
}
