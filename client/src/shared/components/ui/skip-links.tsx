import React from 'react';

interface SkipLink {
  id: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

export function SkipLinks({ links = [] }: SkipLinksProps) {
  const defaultLinks: SkipLink[] = [
    { id: 'main-content', label: 'Skip to main content' },
    { id: 'navigation', label: 'Skip to navigation' },
    { id: 'footer', label: 'Skip to footer' },
  ];

  const allLinks = links.length > 0 ? links : defaultLinks;

  return (
    <div className="sr-only">
      {allLinks.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="skip-to-main focus-visible:not-sr-only"
          data-testid={`link-skip-${link.id}`}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export function useSkipLinks() {
  React.useEffect(() => {
    const handleSkipLink = (e: KeyboardEvent) => {
      if (e.key === 's' && e.ctrlKey && e.shiftKey) {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.focus();
          mainContent.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleSkipLink);
    return () => window.removeEventListener('keydown', handleSkipLink);
  }, []);
}
