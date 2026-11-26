import { redirect } from "next/navigation";

export default async function UserPesananEditRedirectPage({ params }) {
  const { id } = await params;
  redirect(id ? `/user/pesanan/${encodeURIComponent(id)}` : "/user/pesanan");
}
