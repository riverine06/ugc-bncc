import React from "react";

interface BNCCLogoProps {
  className?: string;
  size?: number;
}

export default function BNCCLogo({ className = "", size = 52 }: BNCCLogoProps) {
  const idSuffix = React.useId().replace(/:/g, "_");
  const topArcId = `topArc_${idSuffix}`;
  const bottomArcId = `bottomArc_${idSuffix}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Top Text Path: arc along upper ring */}
        <path
          id={topArcId}
          d="M 26,100 A 74,74 0 1,1 174,100"
        />
        {/* Bottom Text Path: arc along lower ring */}
        <path
          id={bottomArcId}
          d="M 174,100 A 74,74 0 0,1 26,100"
        />
      </defs>

      {/* 1. Outer Red Border */}
      <circle cx="100" cy="100" r="98" fill="#DC2626" />

      {/* 2. Main Dark Charcoal Outer Ring */}
      <circle cx="100" cy="100" r="94" fill="#18181B" />

      {/* 3. Inner Red Ring Border */}
      <circle cx="100" cy="100" r="66" fill="#DC2626" />

      {/* 4. Inner Yellow Background Circle */}
      <circle cx="100" cy="100" r="62" fill="#FDE047" />

      {/* 5. Curved Upper Text: "Knowledge & Discipline" */}
      <text
        fill="#FDE047"
        fontSize="17.5"
        fontWeight="800"
        fontFamily="sans-serif"
        letterSpacing="0.5"
      >
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
          Knowledge &amp; Discipline
        </textPath>
      </text>

      {/* 6. Curved Lower Text: "The Volunteers" */}
      <text
        fill="#FDE047"
        fontSize="17.5"
        fontWeight="800"
        fontFamily="sans-serif"
        letterSpacing="1"
      >
        <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
          The Volunteers
        </textPath>
      </text>

      {/* 7. Side Yellow Stars */}
      {/* Left Star */}
      <polygon
        points="32,97 34.5,102 40,102.5 36,106 37.5,111.5 32,108.5 26.5,111.5 28,106 24,102.5 29.5,102"
        fill="#FDE047"
      />
      {/* Right Star */}
      <polygon
        points="168,97 170.5,102 176,102.5 172,106 173.5,111.5 168,108.5 162.5,111.5 164,106 160,102.5 165.5,102"
        fill="#FDE047"
      />

      {/* 8. Central Tri-Color Triangle */}
      {/* Triangle Outline/Shadow */}
      <polygon
        points="100,48 61,116 139,116"
        fill="#18181B"
      />

      {/* Top Red Triangle Section */}
      <polygon
        points="100,51 136,114 100,93 64,114"
        fill="#DC2626"
      />

      {/* Bottom-Left Royal Blue Section */}
      <polygon
        points="64,114 100,93 100,114"
        fill="#1E40AF"
      />

      {/* Bottom-Right Sky Blue/Cyan Section */}
      <polygon
        points="136,114 100,93 100,114"
        fill="#0284C7"
      />

      {/* 9. Center Text: "BNCC" */}
      <text
        x="100"
        y="147"
        textAnchor="middle"
        fill="#18181B"
        fontSize="24"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="1"
      >
        BNCC
      </text>
    </svg>
  );
}
