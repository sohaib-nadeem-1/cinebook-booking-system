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
    <div className="relative min-h-dvh bg-background lg:grid lg:grid-cols-2">

      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-30 h-16 sm:h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">

        <Link
          to={backTo}
          className="flex items-center gap-2 text-label-md text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
          <span>{backLabel}</span>
        </Link>

        <div className="shrink-0">
          <Logo size="sm" />
        </div>

      </header>

      {/* Left visual panel */}
      <aside
        className="relative hidden lg:flex min-h-dvh flex-col justify-between overflow-hidden border-r border-white/5 px-8 xl:px-12 2xl:px-16 pt-28 pb-12"
        aria-hidden="true"
      >

        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: image ? `url(${image})` : undefined,
            backgroundColor: '#0c0e14',
          }}
        />

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background/95" />

        <div className="absolute inset-0 bg-gradient-to-r from-background/20 to-background/50" />

        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-container/20 blur-[120px]" />

        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-secondary-container/10 blur-[120px]" />

        {/* Top artwork */}
        <div className="relative z-10 w-full max-w-2xl">
          {art?.top}
        </div>

        {/* Bottom artwork */}
        <div className="relative z-10 w-full max-w-2xl mt-16">
          {art?.bottom}
        </div>

      </aside>

      {/* Right form panel */}
      <main className="relative flex min-w-0 min-h-dvh items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-24 pb-10 lg:pt-28 lg:pb-12">

        {/* Mobile background decoration */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-primary-container/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 w-full max-w-[440px] xl:max-w-[480px] 2xl:max-w-[500px] mx-auto">

          {children}

        </div>

      </main>

    </div>
  );
}