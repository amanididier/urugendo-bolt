"use client";

import { motion } from 'framer-motion';

type BadgeType = 'PILOT' | 'COMING_SOON' | 'V1' | 'V2';

interface VersionBadgeProps {
  type: BadgeType;
  pulse?: boolean;
}

export function VersionBadge({ type, pulse = false }: VersionBadgeProps) {
  const getStyles = () => {
    switch (type) {
      case 'PILOT':
        return 'bg-[#00B85C] text-white';
      case 'COMING_SOON':
        return 'bg-[#F4F4F5] text-[#A1A1AA]';
      case 'V1':
        return 'bg-[#DBEAFE] text-[#1E40AF]';
      case 'V2':
        return 'bg-[#FEF3C7] text-[#92400E]';
      default:
        return 'bg-[#00B85C] text-white';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'PILOT':
        return 'PILOT';
      case 'COMING_SOON':
        return 'COMING SOON';
      case 'V1':
        return 'V1';
      case 'V2':
        return 'V2';
      default:
        return type;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${getStyles()} ${
        type === 'PILOT' && pulse ? 'animate-pulse' : ''
      }`}
    >
      {type === 'PILOT' && pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      )}
      {getLabel()}
    </motion.div>
  );
}