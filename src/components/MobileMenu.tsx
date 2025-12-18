'use client';

/**
 * @deprecated This component is now handled by the Sidebar component with isMobile prop
 * Kept for backward compatibility but should not be used in new code
 */

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // This component is deprecated - functionality moved to Sidebar component
  return null;
}
