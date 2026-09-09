export default function DesktopAuthPage() {
  return (
    <main className="grid-fade flex flex-1 items-center justify-center px-5 py-20">
      <div className="hairline w-full max-w-lg rounded-3xl bg-surface p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Desktop login</p>
        <h1 className="mt-3 font-serif text-4xl">Sign in on the Windows app</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Pairing codes are gone. Open Crack on Windows and enter the same email
          and password you use on the website. The app stays logged in until you
          sign out.
        </p>
      </div>
    </main>
  );
}
