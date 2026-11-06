"use client";

import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { Handlebars } from "./handlebars";
import Link from "next/link";

export function Hero() {
	return (
		<div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-between px-4 text-center">
			<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
				<div className="inline-block text-[1.7rem] font-medium uppercase tracking-tight sm:text-4xl md:text-[4rem]">
					<h1>DGDH CUT</h1>
					<Handlebars>Videobewerker</Handlebars>
				</div>

				<p className="text-muted-foreground mx-auto mt-10 max-w-xl text-base tracking-wide sm:text-xl">
					De videobewerker in je browser voor korte video. Knip, kleur en
					exporteer reels snel.
				</p>

				<div className="mt-8 flex justify-center gap-8">
					<Link href="/projects">
						<Button type="submit" size="lg" className="h-11 text-base">
							Projecten openen
							<ArrowRight className="ml-0.5" />
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
