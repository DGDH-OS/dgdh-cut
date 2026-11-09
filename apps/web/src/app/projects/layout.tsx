import { BedrijfBalk } from "@/components/suite/bedrijf-balk";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<BedrijfBalk />
			{children}
		</>
	);
}
