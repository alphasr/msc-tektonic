'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Music2,
  AudioLines,
  GitMerge,
  Search,
  BarChart2,
  Server,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Mixer', icon: Music2, spotify: false },
    { href: '/analyze', label: 'Analyze', icon: AudioLines, spotify: false },
    { href: '/spotify', label: 'Spotify', icon: SpotifyIcon, spotify: true },
    { href: '/candidates', label: 'Candidates', icon: GitMerge, spotify: false },
    { href: '/search', label: 'Search', icon: Search, spotify: false },
    { href: '/stats', label: 'Stats', icon: BarChart2, spotify: false },
    { href: '/status', label: 'Status', icon: Server, spotify: false },
    { href: '/settings', label: 'Settings', icon: Settings, spotify: false },
  ];

  return (
    <nav className='sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/[0.055] h-10 flex items-center'>
      <div className='flex items-center justify-between w-full px-4'>
        <Link href='/' className='flex items-center gap-2 transition-opacity hover:opacity-80 flex-shrink-0'>
          <div className='w-5 h-5 rounded-full bg-primary/25 flex items-center justify-center border border-primary/40 shadow-[0_0_8px_rgba(0,200,232,0.3)]'>
            <div className='w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(0,200,232,0.9)]' />
          </div>
          <span className='text-sm font-bold tracking-[0.12em] text-foreground'>TEKTONIC</span>
        </Link>

        <div className='flex items-center gap-0.5'>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const isSpotify = item.spotify;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium tracking-wide transition-all h-7',
                  isActive && isSpotify
                    ? 'bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/25'
                    : isActive
                    ? 'bg-primary/15 text-primary border border-primary/25'
                    : isSpotify
                    ? 'text-[#1DB954]/60 hover:text-[#1DB954] hover:bg-[#1DB954]/[0.06] border border-transparent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent'
                )}>
                  <Icon className='w-3 h-3' />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
