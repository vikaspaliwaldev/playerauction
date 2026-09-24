export default function AuctionArenaLogo({
  className = '',
  showTagline = true,
  iconOnly = false,
  size = 'normal', // 'small' | 'normal' | 'large'
}) {
  const iconSizes = {
    small: 28,
    normal: 36,
    large: 44,
  };
  const currentSize = iconSizes[size] || 36;

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {/* Stylized Sports Trophy & Gavel Icon */}
      <svg
        width={currentSize}
        height={currentSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="aa-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#aa-logo-grad)" />
        {/* Stylized Gavel / Sports Trophy Fusion */}
        <g transform="translate(4, 4)">
          <path d="M11 21L19 13L22 16L14 24L11 21Z" fill="#FFFFFF" />
          <path
            d="M19 13L22 10C22.6 9.4 23.6 9.4 24.2 10L25 10.8C25.6 11.4 25.6 12.4 25 13L22 16"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M13 23L8 28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="8" r="2.5" fill="#EF4444" />
        </g>
      </svg>

      {!iconOnly && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: size === 'small' ? '1.1rem' : size === 'large' ? '1.6rem' : '1.35rem',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
              color: 'var(--text-primary, #ffffff)',
            }}
          >
            <span>AUCTION</span>
            <span
              style={{
                color: '#8B5CF6',
                background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ARENA
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 8px #EF4444',
                display: 'inline-block',
                marginLeft: 2,
              }}
            />
          </div>

          {showTagline && (
            <span
              style={{
                fontSize: size === 'small' ? '0.58rem' : '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #94A3B8)',
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              LIVE SPORTS PLAYER AUCTIONS
            </span>
          )}
        </div>
      )}
    </div>
  );
}
