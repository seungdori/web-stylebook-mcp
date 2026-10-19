import type { CssDeclaration, MotionCondition } from './css.js';
import { lengthPx, type LengthContext } from './values.js';

export interface UtilityDeclarations {
  declarations: CssDeclaration[];
  target: 'element' | 'before' | 'after';
  motion: MotionCondition;
  /** Tailwind emits responsive variants after base utilities and in breakpoint order (sm < md < lg < xl < 2xl). */
  weight: number;
}

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
const BREAKPOINT_RANK: Record<string, number> = { sm: 1, md: 2, lg: 3, xl: 4, '2xl': 5 };

// Hue and saturation of each palette's 500 shade; shade lightness is approximated below.
const PALETTE: Record<string, [number, number]> = {
  slate: [215, 16], gray: [220, 9], zinc: [240, 4], neutral: [0, 0], stone: [25, 5],
  red: [0, 84], orange: [25, 95], amber: [38, 92], yellow: [45, 93], lime: [84, 81], green: [142, 71],
  emerald: [160, 84], teal: [173, 80], cyan: [189, 94], sky: [199, 89], blue: [217, 91], indigo: [239, 84],
  violet: [258, 90], purple: [271, 91], fuchsia: [292, 84], pink: [330, 81], rose: [350, 89],
};
const SHADE_LIGHTNESS: Record<string, number> = {
  50: 97, 100: 94, 200: 87, 300: 77, 400: 65, 500: 55, 600: 45, 700: 37, 800: 29, 900: 22, 950: 13,
};
const FONT_SIZES: Record<string, string> = {
  xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem',
  '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem', '6xl': '3.75rem', '7xl': '4.5rem', '8xl': '6rem', '9xl': '8rem',
};
const RADII: Record<string, string> = {
  none: '0px', xs: '0.125rem', sm: '0.125rem', '': '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem',
  '2xl': '1rem', '3xl': '1.5rem', '4xl': '2rem', full: '9999px',
};
const BLURS: Record<string, string> = {
  none: '0px', xs: '4px', sm: '4px', '': '8px', md: '12px', lg: '16px', xl: '24px', '2xl': '40px', '3xl': '64px',
};
const SHADOWS: Record<string, string> = {
  '2xs': '0 1px rgb(0 0 0 / 0.05)',
  xs: '0 1px 2px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))',
  sm: '0 1px 2px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))',
  '': '0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))',
  md: '0 4px 6px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 2px 4px -2px var(--tw-shadow-color, rgb(0 0 0 / 0.1))',
  lg: '0 10px 15px -3px var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 4px 6px -4px var(--tw-shadow-color, rgb(0 0 0 / 0.1))',
  xl: '0 20px 25px -5px var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 8px 10px -6px var(--tw-shadow-color, rgb(0 0 0 / 0.1))',
  '2xl': '0 25px 50px -12px var(--tw-shadow-color, rgb(0 0 0 / 0.25))',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
};
const MAX_WIDTHS: Record<string, string> = {
  xs: '20rem', sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem', '3xl': '48rem', '4xl': '56rem',
  '5xl': '64rem', '6xl': '72rem', '7xl': '80rem', prose: '65ch', full: '100%', none: 'none', screen: '100vw',
};
const DIRECTIONS: Record<string, string> = {
  t: 'to top', tr: 'to top right', r: 'to right', br: 'to bottom right', b: 'to bottom', bl: 'to bottom left',
  l: 'to left', tl: 'to top left',
};
const INFINITE_ANIMATIONS: Record<string, string> = {
  spin: 'spin 1s linear infinite',
  ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  bounce: 'bounce 1s infinite',
};
const LOOPING_NAME = /marquee|ticker|scroll|blob|float|drift|shimmer|glow|gradient|orbit|wave|loop|aurora|spin|pulse|flicker|glitch|scan/;

function splitVariants(className: string): string[] {
  const parts: string[] = [];
  let depth = 0; let start = 0;
  for (let i = 0; i < className.length; i++) {
    const ch = className[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) {
      parts.push(className.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(className.slice(start));
  return parts;
}

function arbitrary(value: string): string {
  return value.slice(1, -1).replace(/_/g, ' ');
}

function paletteColor(name: string): string | null {
  const alphaSplit = name.split('/');
  const base = alphaSplit[0]!;
  const alphaText = alphaSplit[1];
  const alpha = alphaText === undefined ? null
    : alphaText.startsWith('[') ? arbitrary(alphaText) : `${parseFloat(alphaText) / 100}`;
  const withAlpha = (color: string) => (alpha === null ? color : `color-mix-alpha(${color}|${alpha})`);
  if (base.startsWith('[') && base.endsWith(']')) return withAlpha(arbitrary(base));
  if (base === 'white') return withAlpha('#ffffff');
  if (base === 'black') return withAlpha('#000000');
  if (base === 'transparent') return 'transparent';
  if (base === 'current' || base === 'inherit') return null;
  const match = /^([a-z]+)-(50|100|200|300|400|500|600|700|800|900|950)$/.exec(base);
  if (!match) return null;
  const hue = PALETTE[match[1]!];
  if (!hue) return null;
  const color = `hsl(${hue[0]} ${hue[1]}% ${SHADE_LIGHTNESS[match[2]!]}%)`;
  return alpha === null ? color : `hsl(${hue[0]} ${hue[1]}% ${SHADE_LIGHTNESS[match[2]!]}% / ${alpha})`;
}

/** Resolve the placeholder used for `white/10`-style alpha on non-palette colors. */
function finishColor(value: string): string {
  const mix = /^color-mix-alpha\((.*)\|(.*)\)$/.exec(value);
  if (!mix) return value;
  const hex = /^#([0-9a-f]{6})$/i.exec(mix[1]!);
  if (!hex) return mix[1]!;
  const n = (i: number) => parseInt(hex[1]!.slice(i, i + 2), 16);
  return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${mix[2]})`;
}

function spacing(token: string, negative: boolean): string | null {
  let value: string | null = null;
  if (token === 'px') value = '1px';
  else if (token === 'full') value = '100%';
  else if (token === 'screen') value = '100vw';
  else if (token === 'auto') value = 'auto';
  else if (/^\d+(?:\.\d+)?$/.test(token)) value = `${parseFloat(token) * 0.25}rem`;
  else if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    value = `${(a! / b!) * 100}%`;
  } else if (token.startsWith('[') && token.endsWith(']')) value = arbitrary(token);
  if (value === null) return null;
  return negative && value !== 'auto' ? `calc(${value} * -1)` : value;
}

function decl(prop: string, value: string): CssDeclaration {
  return { prop, value: finishColor(value), important: false };
}

function utility(raw: string, ctx: LengthContext): CssDeclaration[] | null {
  const negative = raw.startsWith('-');
  const name = negative ? raw.slice(1) : raw;
  const fixed: Record<string, CssDeclaration[]> = {
    block: [decl('display', 'block')], 'inline-block': [decl('display', 'inline-block')], inline: [decl('display', 'inline')],
    flex: [decl('display', 'flex')], 'inline-flex': [decl('display', 'inline-flex')], grid: [decl('display', 'grid')],
    'inline-grid': [decl('display', 'inline-grid')], hidden: [decl('display', 'none')], contents: [decl('display', 'contents')],
    'flex-row': [decl('flex-direction', 'row')], 'flex-col': [decl('flex-direction', 'column')],
    'flex-row-reverse': [decl('flex-direction', 'row-reverse')], 'flex-col-reverse': [decl('flex-direction', 'column-reverse')],
    'flex-wrap': [decl('flex-wrap', 'wrap')], 'flex-nowrap': [decl('flex-wrap', 'nowrap')],
    'items-center': [decl('align-items', 'center')], 'items-start': [decl('align-items', 'flex-start')],
    'items-end': [decl('align-items', 'flex-end')], 'items-stretch': [decl('align-items', 'stretch')],
    'items-baseline': [decl('align-items', 'baseline')],
    'justify-center': [decl('justify-content', 'center')], 'justify-between': [decl('justify-content', 'space-between')],
    'justify-around': [decl('justify-content', 'space-around')], 'justify-evenly': [decl('justify-content', 'space-evenly')],
    'justify-start': [decl('justify-content', 'flex-start')], 'justify-end': [decl('justify-content', 'flex-end')],
    'justify-items-center': [decl('justify-items', 'center')],
    'place-items-center': [decl('align-items', 'center'), decl('justify-items', 'center')],
    'place-content-center': [decl('align-content', 'center'), decl('justify-content', 'center')],
    'self-center': [decl('align-self', 'center')],
    'text-left': [decl('text-align', 'left')], 'text-center': [decl('text-align', 'center')],
    'text-right': [decl('text-align', 'right')], 'text-justify': [decl('text-align', 'justify')],
    'text-start': [decl('text-align', 'start')], 'text-end': [decl('text-align', 'end')],
    static: [decl('position', 'static')], relative: [decl('position', 'relative')], absolute: [decl('position', 'absolute')],
    fixed: [decl('position', 'fixed')], sticky: [decl('position', 'sticky')],
    'mx-auto': [decl('margin-left', 'auto'), decl('margin-right', 'auto')],
    'ml-auto': [decl('margin-left', 'auto')], 'mr-auto': [decl('margin-right', 'auto')],
    uppercase: [decl('text-transform', 'uppercase')], lowercase: [decl('text-transform', 'lowercase')],
    capitalize: [decl('text-transform', 'capitalize')], 'normal-case': [decl('text-transform', 'none')],
    italic: [decl('font-style', 'italic')],
    'font-mono': [decl('font-family', 'ui-monospace, monospace')], 'font-sans': [decl('font-family', 'ui-sans-serif, sans-serif')],
    'font-serif': [decl('font-family', 'ui-serif, serif')],
    grayscale: [decl('filter', 'grayscale(100%)')], 'grayscale-0': [decl('filter', 'grayscale(0)')],
    'bg-clip-text': [decl('background-clip', 'text')], 'text-transparent': [decl('color', 'transparent')],
    'overflow-x-auto': [decl('overflow-x', 'auto')], 'overflow-x-scroll': [decl('overflow-x', 'scroll')],
    'overflow-x-hidden': [decl('overflow-x', 'hidden')], 'overflow-auto': [decl('overflow-x', 'auto')],
    'overflow-scroll': [decl('overflow-x', 'scroll')], 'overflow-hidden': [decl('overflow-x', 'hidden')],
    'snap-x': [decl('scroll-snap-type', 'x mandatory')], 'snap-mandatory': [decl('scroll-snap-type', 'x mandatory')],
    'pointer-events-none': [decl('pointer-events', 'none')],
    'object-cover': [decl('object-fit', 'cover')], 'object-contain': [decl('object-fit', 'contain')],
    'transition-none': [decl('transition-duration', '0s')],
    'animate-none': [decl('animation', 'none')],
    'min-h-screen': [decl('min-height', '100vh')], 'h-screen': [decl('height', '100vh')],
    'w-screen': [decl('width', '100vw')], 'w-full': [decl('width', '100%')], 'h-full': [decl('height', '100%')],
    'inset-0': ['top', 'right', 'bottom', 'left'].map((side) => decl(side, '0px')),
    'inset-x-0': [decl('left', '0px'), decl('right', '0px')], 'inset-y-0': [decl('top', '0px'), decl('bottom', '0px')],
    'bg-radial': [decl('background-image', 'radial-gradient(var(--tw-gradient-from, transparent), var(--tw-gradient-via, transparent), var(--tw-gradient-to, transparent))')],
    'bg-conic': [decl('background-image', 'conic-gradient(var(--tw-gradient-from, transparent), var(--tw-gradient-via, transparent), var(--tw-gradient-to, transparent))')],
    container: [decl('max-width', '80rem')],
    border: [decl('border-width', '1px'), decl('border-style', 'solid')],
  };
  const hit = fixed[name];
  if (hit && !negative) return hit;

  let m: RegExpExecArray | null;
  if ((m = /^grid-cols-(\d+)$/.exec(name))) return [decl('grid-template-columns', `repeat(${m[1]}, minmax(0, 1fr))`)];
  if ((m = /^grid-cols-(\[.+\])$/.exec(name))) return [decl('grid-template-columns', arbitrary(m[1]!))];
  if ((m = /^col-span-(\d+|full)$/.exec(name))) return [decl('grid-column', m[1] === 'full' ? '1 / -1' : `span ${m[1]} / span ${m[1]}`)];
  if ((m = /^rounded(?:-(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?(?:-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[.+\]))?$/.exec(name))) {
    const size = m[1] ?? '';
    return [decl('border-radius', size.startsWith('[') ? arbitrary(size) : RADII[size] ?? '0.25rem')];
  }
  if ((m = /^(backdrop-)?blur(?:-(none|xs|sm|md|lg|xl|2xl|3xl|\[.+\]))?$/.exec(name))) {
    const size = m[2] ?? '';
    const px = size.startsWith('[') ? arbitrary(size) : BLURS[size] ?? '8px';
    return [decl(m[1] ? 'backdrop-filter' : 'filter', `blur(${px})`)];
  }
  if ((m = /^opacity-(\d+|\[.+\])$/.exec(name))) {
    return [decl('opacity', m[1]!.startsWith('[') ? arbitrary(m[1]!) : `${parseInt(m[1]!, 10) / 100}`)];
  }
  if ((m = /^shadow(?:-(2xs|xs|sm|md|lg|xl|2xl|inner|none))?$/.exec(name))) return [decl('box-shadow', SHADOWS[m[1] ?? '']!)];
  if ((m = /^shadow-(\[.+\])$/.exec(name))) return [decl('box-shadow', arbitrary(m[1]!))];
  if ((m = /^shadow-(.+)$/.exec(name))) {
    const color = paletteColor(m[1]!);
    return color ? [decl('--tw-shadow-color', color)] : null;
  }
  if ((m = /^drop-shadow(?:-(sm|md|lg|xl|2xl|none))?$/.exec(name))) {
    return [decl('filter', m[1] === 'none' ? 'none' : 'drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))')];
  }
  if ((m = /^bg-(?:gradient|linear)-to-(t|tr|r|br|b|bl|l|tl)$/.exec(name))) {
    return [decl('background-image', `linear-gradient(${DIRECTIONS[m[1]!]}, var(--tw-gradient-from, transparent), var(--tw-gradient-via, transparent), var(--tw-gradient-to, transparent))`)];
  }
  if ((m = /^bg-(linear|radial|conic)-(.+)$/.exec(name))) {
    return [decl('background-image', `${m[1]}-gradient(var(--tw-gradient-from, transparent), var(--tw-gradient-via, transparent), var(--tw-gradient-to, transparent))`)];
  }
  if ((m = /^(from|via|to)-(.+)$/.exec(name))) {
    const color = paletteColor(m[2]!);
    if (color) return [decl(`--tw-gradient-${m[1]}`, color)];
    return null;
  }
  if ((m = /^bg-(\[.+\])$/.exec(name))) {
    const value = arbitrary(m[1]!).replace(/^image:/, '').replace(/^color:/, '');
    return [decl(/gradient\(|url\(/i.test(value) ? 'background-image' : 'background-color', value)];
  }
  if ((m = /^bg-(.+)$/.exec(name))) {
    const color = paletteColor(m[1]!);
    return color ? [decl('background-color', color)] : null;
  }
  if ((m = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.exec(name))) return [decl('font-size', FONT_SIZES[m[1]!]!)];
  if ((m = /^text-(\[.+\])$/.exec(name))) {
    const value = arbitrary(m[1]!).replace(/^length:/, '');
    return [decl(lengthPx(value, ctx) !== null || /^clamp\(|^calc\(/.test(value) ? 'font-size' : 'color', value)];
  }
  if ((m = /^text-(.+)$/.exec(name))) {
    const color = paletteColor(m[1]!);
    return color ? [decl('color', color)] : null;
  }
  if ((m = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.exec(name))) {
    const weights: Record<string, string> = { thin: '100', extralight: '200', light: '300', normal: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900' };
    return [decl('font-weight', weights[m[1]!]!)];
  }
  if ((m = /^font-(\[.+\])$/.exec(name))) return [decl('font-family', arbitrary(m[1]!))];
  if ((m = /^tracking-(tighter|tight|normal|wide|wider|widest|\[.+\])$/.exec(name))) {
    const tracking: Record<string, string> = { tighter: '-0.05em', tight: '-0.025em', normal: '0em', wide: '0.025em', wider: '0.05em', widest: '0.1em' };
    return [decl('letter-spacing', m[1]!.startsWith('[') ? arbitrary(m[1]!) : tracking[m[1]!]!)];
  }
  if ((m = /^border(?:-[trblxy])?-(0|2|4|8|\[[\d.]+[a-z]*\])$/.exec(name))) {
    return [decl('border-width', m[1]!.startsWith('[') ? arbitrary(m[1]!) : `${m[1]}px`), decl('border-style', 'solid')];
  }
  if ((m = /^border(?:-[trblxy])?$/.exec(name))) return [decl('border-width', '1px'), decl('border-style', 'solid')];
  if ((m = /^border(?:-[trblxy])?-(.+)$/.exec(name))) {
    const color = paletteColor(m[1]!);
    return color ? [decl('border-color', color)] : null;
  }
  if ((m = /^animate-(\[.+\])$/.exec(name))) return [decl('animation', arbitrary(m[1]!))];
  if ((m = /^animate-([\w-]+)$/.exec(name))) {
    const known = INFINITE_ANIMATIONS[m[1]!];
    if (known) return [decl('animation', known)];
    return [decl('animation', LOOPING_NAME.test(m[1]!) ? `${m[1]} 6s linear infinite` : `${m[1]} 1s ease both`)];
  }
  if ((m = /^max-w-(.+)$/.exec(name))) {
    const value = m[1]!.startsWith('[') ? arbitrary(m[1]!) : MAX_WIDTHS[m[1]!] ?? (m[1]!.startsWith('screen-') ? `${BREAKPOINTS[m[1]!.slice(7)] ?? 1280}px` : null);
    return value ? [decl('max-width', value)] : null;
  }
  if ((m = /^(w|h|size|min-h|min-w|max-h)-(.+)$/.exec(name))) {
    const value = spacing(m[2]!, negative);
    if (value === null) return null;
    if (m[1] === 'size') return [decl('width', value), decl('height', value)];
    const prop = { w: 'width', h: 'height', 'min-h': 'min-height', 'min-w': 'min-width', 'max-h': 'max-height' }[m[1]!]!;
    return [decl(prop, value)];
  }
  if ((m = /^(top|right|bottom|left|inset|inset-x|inset-y)-(.+)$/.exec(name))) {
    const value = spacing(m[2]!, negative);
    if (value === null) return null;
    const sides = m[1] === 'inset' ? ['top', 'right', 'bottom', 'left'] : m[1] === 'inset-x' ? ['left', 'right']
      : m[1] === 'inset-y' ? ['top', 'bottom'] : [m[1]!];
    return sides.map((side) => decl(side, value));
  }
  if ((m = /^z-(\d+|auto|\[-?\d+\])$/.exec(name))) {
    const value = m[1]!.startsWith('[') ? arbitrary(m[1]!) : m[1]!;
    return [decl('z-index', negative && value !== 'auto' ? `-${value}` : value)];
  }
  if ((m = /^mix-blend-([\w-]+)$/.exec(name))) return [decl('mix-blend-mode', m[1]!)];
  if ((m = /^(?:transition(?:-\w+)?)$/.exec(name))) return [decl('transition-duration', '150ms')];
  if ((m = /^duration-(\d+)$/.exec(name))) return [decl('transition-duration', `${m[1]}ms`)];
  return null;
}

/** Declarations a Tailwind class contributes at this viewport, or null when it is not a known utility. */
export function tailwindDeclarations(className: string, ctx: LengthContext): UtilityDeclarations | null {
  const parts = splitVariants(className);
  let base = parts.pop() ?? '';
  let important = false;
  if (base.startsWith('!')) { important = true; base = base.slice(1); }
  if (base.endsWith('!')) { important = true; base = base.slice(0, -1); }
  let target: UtilityDeclarations['target'] = 'element';
  let motion: MotionCondition = 'any';
  let rank = 0;
  for (const variant of parts) {
    if (variant in BREAKPOINTS) {
      if (ctx.viewportWidth < BREAKPOINTS[variant]!) return null;
      rank = Math.max(rank, BREAKPOINT_RANK[variant]!);
    } else if (variant.startsWith('max-') && variant.slice(4) in BREAKPOINTS) {
      if (ctx.viewportWidth >= BREAKPOINTS[variant.slice(4)]!) return null;
    } else if (variant === 'before' || variant === 'after') {
      target = variant;
    } else if (variant === 'motion-safe') {
      motion = 'no-preference';
    } else if (variant === 'motion-reduce') {
      motion = 'reduce';
    } else {
      return null;
    }
  }
  const declarations = utility(base, ctx);
  if (!declarations) return null;
  return {
    declarations: declarations.map((item) => ({ ...item, important })),
    target,
    motion,
    weight: rank * 10 + parts.length,
  };
}
