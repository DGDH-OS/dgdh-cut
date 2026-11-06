"use client";

import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { Handlebars } from "./handlebars";
import Link from "next/link";

export function Hero() {
	return (
		<div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-between px-4 text-center">
			<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
				<div className="inline-block text-4xl font-medium uppercase tracking-tight md:text-[4rem]">
					<h1>DGDH CUT</h1>
					<Handlebars>Video editor</Handlebars>
				</div>

				<p className="text-muted-foreground mx-auto mt-10 max-w-xl text-base tracking-wide sm:text-xl">
					The browser-based editor for short-form. Cut, grade, and export
					reels fast.
				</p>

				<div className="mt-8 flex justify-center gap-8">
					<Link href="/projects">
						<Button type="submit" size="lg" className="h-11 text-base">
							Open projects
							<ArrowRight className="ml-0.5" />
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
