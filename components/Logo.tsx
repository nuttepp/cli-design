export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect 
        x="2" y="4" width="20" height="16" rx="3" 
        stroke="url(#logo-gradient)" 
        strokeWidth="2" 
      />
      <path 
        d="M2 8H22" 
        stroke="url(#logo-gradient)" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
      />
      <path 
        d="M7 13L10 16L7 19" 
        stroke="url(#logo-gradient)" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <line 
        x1="12" y1="19" x2="17" y2="19" 
        stroke="url(#logo-gradient)" 
        strokeWidth="2" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
