'use client';

import * as React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxCount?: number;
  className?: string;
  renderOption?: (
    option: MultiSelectOption,
    isSelected: boolean
  ) => React.ReactNode;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found.',
  maxCount,
  className,
  renderOption,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      if (maxCount && selected.length >= maxCount) return;
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const selectedOptions = options.filter((option) =>
    selected.includes(option.value)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full justify-between min-h-10 h-auto', className)}
        >
          <div className='flex flex-wrap gap-1 flex-1 text-left min-w-0'>
            {selected.length === 0 ? (
              <span className='text-muted-foreground'>{placeholder}</span>
            ) : (
              <>
                {selectedOptions.length <= 2 ? (
                  selectedOptions.map((option) => (
                    <Badge
                      key={option.value}
                      variant='secondary'
                      className='mr-1 mb-1 max-w-full'
                    >
                      <span className='truncate'>{option.label}</span>
                      <span
                        role='button'
                        tabIndex={0}
                        className='ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-shrink-0 cursor-pointer inline-flex items-center justify-center'
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(option.value, e as any);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(option.value, e);
                        }}
                        aria-label={`Remove ${option.label}`}
                      >
                        <X className='h-3 w-3 text-muted-foreground hover:text-foreground' />
                      </span>
                    </Badge>
                  ))
                ) : (
                  <Badge variant='secondary' className='mr-1 mb-1'>
                    {selected.length} selected
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronDown className='h-4 w-4 opacity-50 shrink-0 ml-2' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <div className='p-2 border-b'>
          <Input
            type='text'
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='h-8'
          />
        </div>
        <div className='max-h-[300px] overflow-y-auto p-1'>
          {filteredOptions.length === 0 ? (
            <div className='p-4 text-center text-sm text-muted-foreground'>
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    'relative flex cursor-pointer select-none items-start rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent'
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className='absolute left-2 top-2 flex h-4 w-4 items-center justify-center'>
                    {isSelected && (
                      <div className='h-2 w-2 rounded-full bg-primary' />
                    )}
                  </div>
                  <div className='pl-6 flex-1 min-w-0'>
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <>
                        <div className='font-medium'>{option.label}</div>
                        {option.description && (
                          <div className='text-xs text-muted-foreground mt-0.5'>
                            {option.description}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
