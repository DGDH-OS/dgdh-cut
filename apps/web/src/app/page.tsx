import { redirect } from "next/navigation";

// Geen landing als poort (Suite-contract): de proxy stuurt anoniem naar de Suite-login en ingelogd met recht
// direct door; dit is de vangnet-redirect.
export default function Home() {
	redirect("/projects");
}
