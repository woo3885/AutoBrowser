import type { SVGProps } from 'react';

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
);

export const SparkIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
  <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
</Icon>;

export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></Icon>;

export const SunIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;

export const MoonIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" /></Icon>;

export const MonitorIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Icon>;

export const MicIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></Icon>;

export const SendIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></Icon>;

export const LinkIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}>
  <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></Icon>;
