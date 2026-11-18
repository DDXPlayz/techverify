import React from 'react';
import './global.css';

export interface NavbarProps {
  appTitle: string;
  onHomeClick?: (e: React.MouseEvent) => void;
  rightElement?: React.ReactNode;
}

export function Navbar({ appTitle, onHomeClick, rightElement }: NavbarProps) {
  return (
    <header className="anantam-topbar">
      <a
        className="anantam-brand"
        href="https://anantamracing.com"
        onClick={onHomeClick}
        title="Anantam Racing Home"
      >
        ANANTAM<span className="anantam-dot">.</span>
      </a>
      <div className="anantam-topbar-right">
        {rightElement}
        <div className="anantam-brand-sub">{appTitle}</div>
      </div>
    </header>
  );
}
