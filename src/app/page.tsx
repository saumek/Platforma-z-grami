import { LoginScreen } from "@/components/login-screen";

type PageProps = {
  searchParams?: Promise<{
    registered?: string;
    email?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <LoginScreen
      registered={params?.registered === "1"}
      prefilledEmail={params?.email ?? ""}
    />
  );
}
