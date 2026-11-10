import Script from "next/script";
import "./globals.css";
import { DGDH_THEME_SCRIPT } from "./theme/dgdh-theme.inline";
import { Toaster } from "../components/ui/sonner";
import { ChangelogNotification } from "@/changelog/components/changelog-notification";
import { TooltipProvider } from "../components/ui/tooltip";
import { baseMetaData } from "./metadata";
import { BotIdClient } from "botid/client";
import { webEnv } from "@/env/web";
import { Albert_Sans, IBM_Plex_Mono } from "next/font/google";

const albertSans = Albert_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-albert-sans",
});

const plexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-plex-mono",
});

export const metadata = baseMetaData;

const protectedRoutes = [
	{
		path: "/none",
		method: "GET",
	},
];

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="nl" className={`${albertSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
			<head>
				{/* Blokkerend: data-theme + theme-color + color-scheme voor de eerste paint (geen flits). */}
				<script dangerouslySetInnerHTML={{ __html: DGDH_THEME_SCRIPT }} />
				<BotIdClient protect={protectedRoutes} />
				{process.env.NODE_ENV === "development" && (
					<>
						<Script
							src="//unpkg.com/react-scan/dist/auto.global.js"
							crossOrigin="anonymous"
							strategy="beforeInteractive"
						/>
					</>
				)}
			</head>
			<body
				className={`font-sans antialiased`}
			>
					<TooltipProvider>
						<Toaster />
						<Script
							src="https://cdn.databuddy.cc/databuddy.js"
							strategy="afterInteractive"
							async
							data-client-id="UP-Wcoy5arxFeK7oyjMMZ"
							data-disabled={webEnv.NODE_ENV === "development"}
							data-track-attributes={false}
							data-track-errors={true}
							data-track-outgoing-links={false}
							data-track-web-vitals={false}
							data-track-sessions={false}
						/>
						{children}
					</TooltipProvider>
			</body>
		</html>
	);
}
