import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useColors } from '../theme';

export type IconName =
  | 'eye'
  | 'eyeOff'
  | 'settings'
  | 'scan'
  | 'sun'
  | 'moon'
  | 'person'
  | 'onion'
  | 'globe'
  | 'lock'
  | 'info'
  | 'arrowDown'
  | 'arrowUp';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z';

/** Small line icons, drawn on a 24-point grid. */
export function Icon({ name, size = 22, color }: Props) {
  const colors = useColors();
  const stroke = {
    stroke: color ?? colors.gold,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'eye' && (
        <>
          <Path d={EYE} {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
        </>
      )}
      {name === 'eyeOff' && (
        <>
          <Path d={EYE} {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Line x1={4} y1={20} x2={20} y2={4} {...stroke} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} {...stroke} />
          <Line x1={4} y1={12} x2={20} y2={12} {...stroke} />
          <Line x1={4} y1={17} x2={20} y2={17} {...stroke} />
          <Circle cx={9} cy={7} r={2.2} {...stroke} fill={colors.ink} />
          <Circle cx={15} cy={12} r={2.2} {...stroke} fill={colors.ink} />
          <Circle cx={8} cy={17} r={2.2} {...stroke} fill={colors.ink} />
        </>
      )}
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={4} {...stroke} />
          <Line x1={12} y1={2.5} x2={12} y2={5} {...stroke} />
          <Line x1={12} y1={19} x2={12} y2={21.5} {...stroke} />
          <Line x1={2.5} y1={12} x2={5} y2={12} {...stroke} />
          <Line x1={19} y1={12} x2={21.5} y2={12} {...stroke} />
          <Line x1={5.3} y1={5.3} x2={7} y2={7} {...stroke} />
          <Line x1={17} y1={17} x2={18.7} y2={18.7} {...stroke} />
          <Line x1={5.3} y1={18.7} x2={7} y2={17} {...stroke} />
          <Line x1={17} y1={7} x2={18.7} y2={5.3} {...stroke} />
        </>
      )}
      {name === 'moon' && (
        <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" {...stroke} />
      )}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8} r={3.5} {...stroke} />
          <Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" {...stroke} />
        </>
      )}
      {name === 'onion' && (
        <>
          <Path
            d="M12 3c0 3.2-6.5 5.2-6.5 11.2a6.5 6.5 0 0 0 13 0C18.5 8.2 12 6.2 12 3z"
            {...stroke}
          />
          <Path
            d="M12 9c0 2-3 3.2-3 6a3 3 0 0 0 6 0c0-2.8-3-4-3-6z"
            {...stroke}
          />
        </>
      )}
      {name === 'globe' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Line x1={3} y1={12} x2={21} y2={12} {...stroke} />
          <Path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" {...stroke} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2} {...stroke} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...stroke} />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Line x1={12} y1={11} x2={12} y2={16.5} {...stroke} />
          <Line x1={12} y1={7.6} x2={12} y2={7.7} {...stroke} />
        </>
      )}
      {name === 'arrowDown' && (
        <Path d="M12 5v14M6 13l6 6 6-6" {...stroke} strokeWidth={2.2} />
      )}
      {name === 'arrowUp' && (
        <Path d="M12 19V5M6 11l6-6 6 6" {...stroke} strokeWidth={2.2} />
      )}
      {name === 'scan' && (
        <>
          <Path d="M4 8V5a1 1 0 0 1 1-1h3" {...stroke} />
          <Path d="M16 4h3a1 1 0 0 1 1 1v3" {...stroke} />
          <Path d="M20 16v3a1 1 0 0 1-1 1h-3" {...stroke} />
          <Path d="M8 20H5a1 1 0 0 1-1-1v-3" {...stroke} />
          <Rect x={9} y={9} width={6} height={6} rx={1} {...stroke} />
        </>
      )}
    </Svg>
  );
}
