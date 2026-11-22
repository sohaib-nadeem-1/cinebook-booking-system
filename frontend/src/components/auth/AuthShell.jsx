
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../common/Logo.jsx';

export default function AuthShell({
  image,
  art,
  children,
  backTo = '/',
  backLabel = 'Back to browse',
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">

      {/* Responsive Header */}
      <header className="absolute top-0 inset-x-0 z-20 min-h-16 px-4 md:px-6 flex items-center justify-between gap-3 bg-surface/60 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none">

        {/* Back Button */}
        <Link
          to={backTo}
          className="flex items-center gap-2 text-label-md text-secondary hover:text-white shrink-0"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          <span>{backLabel}</span>
        </Link>

        {/* Logo */}
        <div className="shrink-0">
          <Logo size="sm" />
        </div>

      </header>

      {/* Desktop Artwork */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden px-10 pt-24 pb-10 border-r border-white/5"
        aria-hidden={false}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: image ? `url(${image})` : undefined,
            backgroundColor: '#0c0e14',
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />

        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-container/25 blur-[120px]" />

        <div className="relative z-10">
          {art?.top}
        </div>

        <div className="relative z-10">
          {art?.bottom}
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative flex items-center justify-center px-4 pt-24 pb-10 lg:py-10 min-h-screen">

        <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-primary-container/10 to-transparent pointer-events-none" />

        <div className="relative w-full max-w-[460px] min-w-0">
          {children}
        </div>

      </main>
    </div>
  );
}
