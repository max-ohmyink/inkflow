import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>Oh My Ink - Live AI Tattoo Experience</title>
        <meta
          name="description"
          content="Our tattoo artists’ catalog comes first. Explore a new AI design only when there’s no suitable match, choose filled colors, and enjoy your next non-permanent ink moment with the Oh My Ink team."
        />
        <meta name="theme-color" content="#FFECDE" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Oh My Ink Live" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/web-icons/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html,body{background:#FFECDE;color:#111111}button,a,[role="button"],[role="tab"]{-webkit-tap-highlight-color:transparent}:focus-visible{outline:3px solid #111111;outline-offset:4px}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
