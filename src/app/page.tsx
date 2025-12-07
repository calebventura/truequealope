import TestFirestoreClient from "@/components/TestFirestoreClient";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Next.js + Firebase</h1>
      <TestFirestoreClient />
    </div>
  );
}
