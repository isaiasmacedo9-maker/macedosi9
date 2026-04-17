import React from 'react';

const sizeMap = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
};

const MacedoLogo = ({ size = 'md', className = '' }) => {
  return (
    <div className={`${sizeMap[size] || sizeMap.md} overflow-hidden rounded-xl shadow-lg shadow-black/40 ${className}`}>
      <svg viewBox="0 0 100 120" className="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="100" height="120" fill="#F62A2D" />
        <path d="M16 34L16 114L40 98L40 66L50 75L85 50L85 37L50 62L32 49L16 58Z" fill="#06070A" />
        <path d="M84 90L84 115L64 99L76 90H84Z" fill="#06070A" />
        <path d="M22 19L50 39L78 19V30L50 50L22 30V19Z" fill="#E8E8E8" />
      </svg>
    </div>
  );
};

export default MacedoLogo;
