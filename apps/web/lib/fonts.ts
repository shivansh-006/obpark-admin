import localFont from 'next/font/local'
import { Michroma, Plus_Jakarta_Sans } from 'next/font/google'

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const michroma = Michroma({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-michroma',
  display: 'swap',
  preload: true,
})

// Highly legible, award-winning modern replacement for legacy microgrammaBold
export const microgrammaBold = plusJakarta

export const geistSans = localFont({
  src: '../public/fonts/geist-variable.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
})

export const FONTS = {
  plusJakarta,
  microgrammaBold,
  michroma,
  geistSans,
}

export default FONTS


