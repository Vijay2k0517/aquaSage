import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070B14] text-slate-100 font-mono p-4">
      <div className="p-8 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl max-w-md w-full text-center space-y-4">
        <div className="text-4xl font-bold text-cyan-400">404</div>
        <h1 className="text-lg font-bold text-white">Page Not Found</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          The requested route does not exist in the AquaSage digital twin application.
        </p>
        <Link
          href="/simulator"
          className="inline-block px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-md shadow-cyan-950/50"
        >
          Return to Simulator
        </Link>
      </div>
    </div>
  );
}
