'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useMemo } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  maxItems?: number;
}

// Map routes to labels
const routeLabels: Record<string, string> = {
  '': 'Home',
  'dashboard': 'Dashboard',
  'campaigns': 'Campaigns',
  'reports': 'Reports',
  'automation': 'Automation',
  'team': 'Team',
  'approvals': 'Approvals',
  'activity': 'Activity',
  'settings': 'Settings',
};

export default function Breadcrumb({
  items: customItems,
  showHome = true,
  maxItems = 4,
}: BreadcrumbProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const items = useMemo(() => {
    if (customItems) return customItems;

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({
        label: 'Home',
        href: '/',
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        ),
      });
    }

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  }, [customItems, pathname, showHome]);

  // Truncate if too many items
  const displayItems = useMemo(() => {
    if (items.length <= maxItems) return items;

    const first = items[0];
    const last = items.slice(-2);
    return [
      first,
      { label: '...', href: undefined },
      ...last,
    ];
  }, [items, maxItems]);

  if (displayItems.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center">
      <ol className="flex items-center space-x-1 text-sm">
        {displayItems.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <li className="text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
            )}
            <li>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-1 font-medium text-gray-900">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
