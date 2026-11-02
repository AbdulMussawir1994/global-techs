"use client";

export default function EmployeeError({ retry }: { retry: () => void }) {
  return (
    <main className="initial-loading" role="alert">
      <h1>We couldn’t load your workspace</h1>
      <p>Please try again to reconnect to your employee directory.</p>
      <button className="button button-primary" onClick={retry}>Try again</button>
    </main>
  );
}
