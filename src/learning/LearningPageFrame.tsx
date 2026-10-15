import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CurveMark } from './Preview';
import './learning.css';
import './learning-page.css';

/** Shared page chrome for setup, the free workspace, and plan selection. */
export function LearningPageFrame({ children, label, demo = false, className = '' }: {
  children: ReactNode; label: string; demo?: boolean; className?: string;
}) {
  const { signOut } = useAuth();
  return <div className={`learn learning-page ${className}`}>
    <a className="learning-skip-link" href="#learning-page-content">Skip to content</a>
    <header className="learning-page-header">
      <div className="learning-page-header-inner">
        <Link className="learn-brand" to="/" aria-label="Curve home"><CurveMark /><span>curve</span></Link>
        <span className="learning-page-label">{label}</span>
        {demo ? <Link className="learn-button subtle" to="/welcome">Exit preview</Link>
          : <button className="learn-button subtle" onClick={() => void signOut()}>Sign out</button>}
      </div>
    </header>
    <main id="learning-page-content" className="learning-page-content" tabIndex={-1}>{children}</main>
    <footer className="learning-page-footer">
      <span>{demo ? 'Interactive preview · nothing is saved' : 'Your subjects. Your pace.'}</span>
      <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
    </footer>
  </div>;
}
