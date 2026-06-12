import React from "react";
import logoTeal from "../assets/unke__logo.svg";
import logoWhite from "../assets/unke__logo_blanco.svg";
import isologoTeal from "../assets/unke__isologo.svg";
import isologoWhite from "../assets/unke__isologo_blanco.svg";

interface UnkeLogoProps {
  className?: string;
  showSubtitle?: boolean;
  light?: boolean; // If true, showcases the logo configured for dark/black backgrounds
  style?: React.CSSProperties;
}

export default function UnkeLogo({ className = "h-12", showSubtitle = true, light = false, style }: UnkeLogoProps) {
  // Always use the original color versions that have the green/teal
  const selectedLogo = showSubtitle ? logoTeal : isologoTeal;

  return (
    <img
      src={selectedLogo}
      alt="UNKE Logo"
      className={`${className} object-contain`}
      id="unke-brand-image-logo"
      style={style}
    />
  );
}
