import { BedrijfBalk } from "@/components/suite/bedrijf-balk";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<BedrijfBalk />
			{children}
		</>
	);
}
