'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Music,
  BarChart3,
  Search,
  FileText,
  Activity,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Music },
    { href: '/analyze', label: 'Analyze', icon: FileText },
    { href: '/candidates', label: 'Candidates', icon: BarChart3 },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/stats', label: 'Stats', icon: Activity },
    { href: '/status', label: 'Status', icon: Settings },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className='sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5 shadow-sm'>
      <div className='container mx-auto px-6 py-3'>
        <div className='flex items-center justify-between'>
          <Link href='/' className='flex items-center gap-3 transition-opacity hover:opacity-80'>
            <div className='w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_rgba(0,229,255,0.2)]'>
              <div className='w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(0,229,255,0.8)]' />
            </div>
            <span className='text-xl font-bold tracking-tight text-foreground'>TEKTONIC</span>
          </Link>
          <div className='flex items-center gap-1.5'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size='sm'
                    className={cn(
                      "font-medium tracking-wide text-xs px-3 py-1.5 h-8 transition-all rounded-md",
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,229,255,0.3)]' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <Icon className='w-4 h-4 mr-2 opacity-80' />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
